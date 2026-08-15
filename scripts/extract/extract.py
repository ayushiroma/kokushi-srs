"""厚労省の公開PDFから国試問題を機械的に抽出する。

**このスクリプトはAIに問題文を書かせない。** PDFのテキストをそのまま転記するだけ。
偽の国試問題が混入するとシステムの目的そのものが壊れるため、
「それらしく整える」処理は入れない（空白の正規化・行の連結・段落の復元のみ）。

使い方:
    py -3 extract.py --probe <問題pdf> [--show 3,4,31]
    py -3 extract.py --answers <正答pdf>
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from dataclasses import dataclass, field as dc_field
from pathlib import Path

import pymupdf

MAP_PATH = Path(__file__).with_name("glyphmap.json")


def load_map() -> dict[str, dict[str, str]]:
    if not MAP_PATH.exists():
        return {}
    return json.loads(MAP_PATH.read_text(encoding="utf-8"))


def repair_for(pdf_name: str) -> dict[str, str] | None:
    """その回の「化けた文字 → 本来の文字」の対応表。無ければ None。"""
    return load_map().get(Path(pdf_name).stem)


def repair_chars(text: str, mapping: dict[str, str] | None) -> str:
    """対応表に従って文字を戻す。**表に無い文字は勝手に埋めず、そのまま残す。**

    残った化け文字は generate.py が検知して、その回の生成を止める。

    ⚠️ **1行分ずつ渡すこと。** 化けた文字コードには `U+000A`（改行と同じ値）や
    `U+000D` が含まれる回がある。複数行を繋いだ文字列に当てると、行の区切りまで
    数字に変換されてページ全体が1行に潰れる。
    """
    if not mapping:
        return text
    return "".join(mapping.get(f"{ord(ch):04X}", ch) for ch in text)


def repair_brackets(text: str, mapping: dict[str, str] | None) -> str:
    """ラテン文字が 〈〉 の代役になっている場合の対応。行を繋いだ後に当てる。"""
    if mapping:
        brackets = mapping.get("_brackets")
    else:
        brackets = None
    if not isinstance(brackets, dict):
        return text
    # 〈〉 の代役がラテン文字で、文字単体では本物と区別できない場合
    # （`Kaup?カウプC指数` の C は括弧、`COPD` の C は本物）。
    # 閉じ括弧の直後がラテン文字なら英単語の一部なので対にしない。
    # 中身に改行を許すのは `法律〈障害者総合支援\n法〉` のように行をまたぐため。
    # 60文字なのは `DOTS〈Directly Observed Treatment,Short-course〉` に合わせたもの。
    o, c = re.escape(brackets["open"]), re.escape(brackets["close"])
    return re.sub(rf"{o}([^{o}]{{1,60}}?){c}(?![A-Za-z])", r"〈\1〉", text)

# ページ先頭の版面ヘッダー（例: DKIX-05-前H-13）。回によって記号が変わるので緩く取る
HEADER_RE = re.compile(r"^[A-Z]{2,8}-\d{2}-[^\s]*-\d+$")
CHOICE_RE = re.compile(r"^\s*([1-5])．\s*(.*)$")
# 状況設定問題の共通文の始まり（例: 次の文を読み112～114 の問いに答えよ。）
SHARED_RE = re.compile(r"^次の文を読み.*問いに答えよ。?\s*$")
# 表紙・注意事項・解答用紙見本のページの目印。
# これらのページには設問例（201〜204番）とマークシートの見本が載っていて、
# 本文と間違えると見本の数字を問題番号と誤認して全体が崩れる
FRONT_MATTER_RE = re.compile(r"注\s*意\s*事\s*項|[（(]例\s*\d|答案用紙|指示があるまで開かない")

# 図表を参照する問題はテキストだけでは解けないので除外する。
# 「意図」「企図」を弾き、「示す」までの距離を句点の手前までに限定して誤検出を防ぐ
# （例：選択肢に「磁気共鳴画像〈MRI〉」がある問題は図表問題ではない）。
# 「別冊No.◯」は必ず図表なので単独で除外条件にする。
FIGURE_RE = re.compile(
    r"(?<![意企構壮])図[^。]{0,15}(示す|参照)"
    r"|写真[^。]{0,15}(示す|参照)"
    r"|別冊"
)
CALC_RE = re.compile(r"解答[:：]")
COMBINATION_RE = re.compile(r"組合せ|組み合わせ")


@dataclass
class Question:
    number: int
    text: str = ""
    choices: list[str] = dc_field(default_factory=list)
    shared_context: str | None = None
    excluded: str | None = None
    warnings: list[str] = dc_field(default_factory=list)
    raw_lines: list[str] = dc_field(default_factory=list)


def is_cjk(ch: str) -> bool:
    if ch == "":
        return False
    return unicodedata.name(ch, "").startswith(("CJK", "HIRAGANA", "KATAKANA"))


# 和文とみなす文字（かな・漢字・全角記号）。四分アキを詰める判定に使う
JP = r"぀-ヿ㐀-䶿一-鿿、-〿＀-￯"
QUARTER_AFTER = re.compile(rf"(?<=[0-9A-Za-z]) (?=[{JP}])")
QUARTER_BEFORE = re.compile(rf"(?<=[{JP}]) (?=[0-9A-Za-z])")
# 「まるごと欧文の行」＝病名などの英語併記の行。和文の折り返しと区別するために使う
LATIN_LINE = re.compile(r"[A-Za-z][A-Za-z0-9 ,.\-'’()/&]*")


def normalize(text: str) -> str:
    """1行分の空白を整える。文字そのものは変えない。

    国試PDFは日本語組版の慣習で2種類の余分な空白を持つ:
      ① 2文字の熟語の字間（「圧　迫」）→ 詰める
      ② 和文と英数字の境目の四分アキ（「3 週間」「A さん」）→ 詰める
    ②を残すと「3 週間」「20 歳」のようになり、検索でも読みでも本文と食い違う。
    **行をまたぐ連結で入れた空白は別扱い**（英語併記の `diabetes mellitus 糖尿病`
    はそのまま残す必要があるため、この関数は1行分にだけ適用する）。
    """
    out: list[str] = []
    for i, ch in enumerate(text):
        if ch != "　":
            out.append(ch)
            continue
        prev = text[i - 1] if i > 0 else ""
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if is_cjk(prev) and is_cjk(nxt):
            continue  # 「圧　迫」→「圧迫」
        out.append(" ")
    joined = re.sub(r" {2,}", " ", "".join(out)).strip()
    joined = QUARTER_AFTER.sub("", joined)
    return QUARTER_BEFORE.sub("", joined)


def join_lines(lines: list[str]) -> str:
    """PDFの折り返しを連結する。

    各行を先に整えてから連結する。行をまたぐ空白は「直前の行がまるごと欧文」の
    ときだけ入れる。国試PDFは病名の英語併記を独立した行に組むので
    （`diabetes mellitus` の次の行が `糖尿病`）そこは空けたい。一方、和文の途中で
    折り返しただけの `…勤め先のC` ＋ `健康保険組合…` は詰めなければならない。
    「行末が英数字か」で判定すると後者まで空いてしまうため、行全体で判定する。
    """
    result = ""
    previous = ""
    for line in lines:
        piece = normalize(line)
        if piece == "":
            continue
        if result == "":
            result = previous = piece
            continue
        result += (" " if LATIN_LINE.fullmatch(previous) else "") + piece
        previous = piece
    return result


def join_paragraphs(lines: list[str]) -> str:
    """全角スペースで始まる行を段落の始まりとみなして復元する。

    状況設定問題は「状況の説明」と「設問」が別段落になっている。詰めてしまうと
    どこからが問われている内容なのか読み取れなくなる。
    """
    paragraphs: list[list[str]] = []
    for line in lines:
        if line.strip() == "":
            continue
        if line.startswith("　") or not paragraphs:
            paragraphs.append([line])
        else:
            paragraphs[-1].append(line)
    return "\n\n".join(p for p in (join_lines(par) for par in paragraphs) if p != "")


def join_choice(lines: list[str], combination: bool) -> str:
    """選択肢1つ分を連結する。

    「組合せ」問題は左右2段組で、段の切れ目がPDF上では「末尾の空白2つ」または
    「空白だけの行」として現れる。詰めると `児童福祉法医療的ケア児が…` になって
    どこが区切りか分からなくなるため、組合せ問題に限って ── を補う。
    """
    if not combination:
        return join_lines(lines)
    left: list[str] = []
    right: list[str] = []
    split_done = False
    for line in lines:
        if not split_done and (line.strip() == "" or re.search(r"\S {2,}$", line)):
            if line.strip() != "":
                left.append(line)
            split_done = True
            continue
        (right if split_done else left).append(line)
    if not split_done or not right:
        return join_lines(lines)
    return f"{join_lines(left)} ── {join_lines(right)}"


def strip_header_and_nombre(lines: list[str]) -> list[str]:
    """版面ヘッダーと、その直後に来るノンブル（ページ番号）を落とす。

    回によってヘッダーの位置が3種類ある:
      A（新しい回）  ヘッダー → 全角スペースだけの行 → ノンブル → 本文
      B（看護師111〜114回） 本文 → ヘッダー → ノンブル（ページ末尾）
      C（保健師108〜109回） ヘッダー → ノンブル → 本文
    位置で決め打つと版面が変わるたびに全問取りこぼす。**ヘッダーを見つけたら、
    その次に現れる「数字だけの行」がノンブル**、という関係だけに頼る。

    ノンブルを残すと問題番号と衝突して問題の切れ目を誤検出するので、必ず落とす。
    """
    out: list[str] = []
    expect_nombre = False
    for line in lines:
        stripped = line.strip()
        if HEADER_RE.match(stripped):
            expect_nombre = True
            continue
        if expect_nombre:
            if stripped == "":
                continue  # 全角スペースだけの行もここに入る
            if re.fullmatch(r"\d{1,3}", stripped):
                expect_nombre = False
                continue
            expect_nombre = False
        out.append(line)
    return out


def page_body_size(page: pymupdf.Page) -> float:
    """そのページの本文フォントサイズ（最頻値）。

    英語の読み仮名（ルビ）は本文より小さいフォントで組まれている
    （実測で本文12.0pt・ルビ7.8pt）。最頻値を使うのは、ページ内に
    まれに別サイズの文字（罫線の数字など）が混じっても引きずられないため。
    """
    sizes = [
        round(span.get("size", 0), 1)
        for block in page.get_text("rawdict")["blocks"]
        for line in block.get("lines", [])
        for span in line.get("spans", [])
        if span["chars"]
    ]
    if not sizes:
        return 0.0
    counts: dict[float, int] = {}
    for s in sizes:
        counts[s] = counts.get(s, 0) + 1
    return max(counts, key=lambda s: counts[s])


def page_lines(page: pymupdf.Page) -> list[str]:
    """1ページを行の列にする。

    `page.get_text()` は行の区切りを `\\n` で表すが、化けた文字コードに
    `U+000A`（改行と同じ値）が含まれる回があり、両者を区別できない。
    グリフ単位で取れる `rawdict` を使い、行の区切りは構造から決める。

    英語の読み仮名（ルビ）は本文より小さいフォントで、本文中の別の行として
    埋め込まれている。文字コードそのものは正しく取れているが、そのまま
    連結すると単語の途中に挟み込まれて意味不明になる
    （例：`成人のばね指で正snapping fingerしいのはどれか`）。
    フォントサイズが本文より明らかに小さい文字の並びを 〈 〉 で囲むことで、
    読み仮名だとわかる形にする（挿入位置がずれることはあるが、単語を
    分断してしまうよりは安全）。

    版面ヘッダー（`DKIX-05-前H-7`）やノンブル（ページ番号だけの行）も本文より
    小さいフォントで組まれていることがある。これらに 〈〉 を付けると
    `strip_header_and_nombre` の正規表現と一致しなくなり、ヘッダーとして
    検知できずに直前の問題の末尾へ紛れ込む。**行全体がヘッダー／ノンブルと
    一致する場合は、ブラケット無しの生テキストを使う。**

    `SpO〈2〉`（`SpO2` の下付き2）のように、既に〈〉付きの略語の中にある
    下付き数字も本文より小さいフォントで組まれている。これを読み仮名として
    扱うと `〈SpO〈2〉〉` と二重括弧になってしまう。**英字を含まない
    （数字だけの）小さい文字列は読み仮名として扱わない。**
    """
    body_size = page_body_size(page)
    lines: list[str] = []
    for block in page.get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            raw_parts: list[str] = []
            parts: list[str] = []
            in_ruby = False
            for span in line.get("spans", []):
                text = "".join(c["c"] for c in span["chars"])
                if not text:
                    continue
                raw_parts.append(text)
                is_small = bool(body_size) and span.get("size", body_size) < body_size * 0.85
                # 英字を含まない小さい文字列（SpO〈2〉の下付き2など）は読み仮名でなく
                # 略語の一部の下付き文字なので、既に in_ruby でない限り括弧を付けない
                is_ruby = is_small and (in_ruby or re.search(r"[A-Za-z]", text))
                if is_ruby and not in_ruby:
                    parts.append("〈")
                    in_ruby = True
                elif not is_ruby and in_ruby:
                    parts.append("〉")
                    in_ruby = False
                    if text.strip() == "":
                        continue  # 〉直後の区切り用の空白は組版の都合なので落とす
                parts.append(text)
            if in_ruby:
                parts.append("〉")
            raw_text = "".join(raw_parts)
            stripped = raw_text.strip()
            if HEADER_RE.match(stripped) or re.fullmatch(r"\d{1,3}", stripped):
                lines.append(raw_text)
            else:
                lines.append("".join(parts))
    return lines


def body_pages(doc: pymupdf.Document, mapping: dict[str, str] | None = None) -> list[list[str]]:
    """問題本文のページだけを、ヘッダーとノンブルを落として返す。

    表紙・注意事項・解答用紙見本のページは、`（例1 ）` のような設問例と
    マークシートの見本（数字だけの行が延々と続く）を含む。これを本文と
    間違えると、見本の数字を問題番号と誤認して全体が崩れる。

    文字化けの修復は**ページ全体に対して**行う。括弧が行をまたぐことがあり、
    行ごとに直すと対にできないため。
    """
    pages: list[list[str]] = []
    for page in doc:
        if FRONT_MATTER_RE.search(page.get_text()):
            continue
        cleaned = strip_header_and_nombre(
            [repair_chars(line, mapping) for line in page_lines(page)]
        )
        if any(line.strip() for line in cleaned):
            pages.append(cleaned)
    return pages


def parse_questions(
    doc: pymupdf.Document, total: int, mapping: dict[str, str] | None = None
) -> list[Question]:
    """問題番号の連番を頼りに切り分ける。

    「次に来るのは必ず N 番」と決め打つことで、選択肢番号や本文中の数字との
    取り違えを防ぐ。番号が飛んだら取りこぼしとして報告する。
    """
    lines = [line for page in body_pages(doc, mapping) for line in page]
    questions: list[Question] = []
    expected = 1
    current: Question | None = None
    shared: str | None = None
    shared_buffer: list[str] | None = None

    for line in lines:
        if SHARED_RE.match(line.strip()):
            shared_buffer = []
            shared = None
            continue

        is_head = re.match(rf"^\s*{expected}(?:\s|$)", line) and not CHOICE_RE.match(line)
        if is_head and expected <= total:
            if shared_buffer is not None:
                shared = join_paragraphs(shared_buffer)
                shared_buffer = None
            if current is not None:
                questions.append(current)
            rest = line.strip()[len(str(expected)):]
            current = Question(number=expected, shared_context=shared)
            if rest.strip():
                current.raw_lines.append(rest)
            expected += 1
            continue

        if shared_buffer is not None:
            shared_buffer.append(line)
        elif current is not None:
            current.raw_lines.append(line)

    if current is not None:
        questions.append(current)

    for q in questions:
        split_choices(q)
    return questions


def split_choices(q: Question) -> None:
    stem: list[str] = []
    groups: list[list[str]] = []
    for line in q.raw_lines:
        m = CHOICE_RE.match(line)
        if m and int(m.group(1)) == len(groups) + 1:
            groups.append([m.group(2)])
        elif groups:
            groups[-1].append(line)
        else:
            stem.append(line)
    q.text = join_paragraphs(stem)
    combination = bool(COMBINATION_RE.search(q.text))
    q.choices = [join_choice(g, combination) for g in groups]


# 正答値表の設問番号は回によって2形式ある。A001/B001（新しい回）と AM1/PM1（古い回）
ANSWER_KEY_RE = re.compile(r"^(?:([AB])(\d{3})|(AM|PM)(\d{1,3}))$")


def normalize_answer_key(token: str) -> str | None:
    """`A001` も `AM1` も `am-1` の形に揃える。"""
    m = ANSWER_KEY_RE.match(token)
    if not m:
        return None
    if m.group(1):
        session = "am" if m.group(1) == "A" else "pm"
        return f"{session}-{int(m.group(2))}"
    return f"{m.group(3).lower()}-{int(m.group(4))}"


def parse_answers(pdf: Path) -> dict[str, list[str]]:
    """正答値表を読む。値が空なら削除問題。

    表には「正答１/正答２/正答３」の列がある。1つの設問に複数の値が並ぶのは
    「どちらを選んでも正解」という意味で、「2つ選べ」の複数選択とは別物。
    複数選択は `14` のように1つの数値にまとまって入る。区別できるよう、
    値はトークンの列のまま返す。
    """
    doc = pymupdf.open(pdf)
    tokens: list[str] = []
    for page in doc:
        tokens.extend(t.strip() for t in page.get_text().split("\n") if t.strip())

    answers: dict[str, list[str]] = {}
    key: str | None = None
    for token in tokens:
        normalized = normalize_answer_key(token)
        if normalized is not None:
            key = normalized
            answers.setdefault(key, [])
        elif key is not None and re.fullmatch(r"\d{1,3}", token):
            answers[key].append(token)
    return answers


def classify(q: Question) -> str | None:
    """採用しない理由を返す。採用するなら None。"""
    whole = f"{q.shared_context or ''} {q.text} {' '.join(q.choices)}"
    if CALC_RE.search(whole):
        return "計算問題"
    if FIGURE_RE.search(whole):
        return "図表参照"
    if len(q.choices) < 4:
        return f"選択肢{len(q.choices)}個"
    return None


def analyze(
    doc: pymupdf.Document, total: int, mapping: dict[str, str] | None = None
) -> list[Question]:
    questions = parse_questions(doc, total, mapping)
    # 〈〉 の代役の対応付けは、行を繋いだ後でないとできない
    # （`法律〈障害者総合支援\n法〉` のように括弧が行をまたぐため）
    for q in questions:
        q.text = repair_brackets(q.text, mapping)
        q.choices = [repair_brackets(c, mapping) for c in q.choices]
        if q.shared_context is not None:
            q.shared_context = repair_brackets(q.shared_context, mapping)
    for q in questions:
        q.excluded = classify(q)
        if q.excluded is None and len(q.choices) > 5:
            q.warnings.append(f"選択肢が{len(q.choices)}個ある")
        if q.excluded is None and len(q.text) < 8:
            q.warnings.append("問題文が極端に短い")
    return questions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe", type=Path)
    parser.add_argument("--answers", type=Path)
    parser.add_argument("--total", type=int, default=120)
    parser.add_argument("--show", type=str, default="")
    args = parser.parse_args()

    if args.answers:
        answers = parse_answers(args.answers)
        blanks = [k for k, v in answers.items() if not v]
        alts = {k: v for k, v in answers.items() if len(v) > 1}
        print(f"正答 {len(answers)} 件 / 空欄（削除問題） {len(blanks)} 件: {blanks}")
        print(f"複数の値が入っている（どちらでも正解） {len(alts)} 件: {alts}")
        return

    if not args.probe:
        parser.error("--probe か --answers を指定してください")

    doc = pymupdf.open(args.probe)
    questions = analyze(doc, args.total)
    print(f"抽出 {len(questions)} 件（期待 {args.total} 件）")
    missing = sorted(set(range(1, args.total + 1)) - {q.number for q in questions})
    if missing:
        print(f"⚠️ 取りこぼし: {missing}")
    reasons: dict[str, list[int]] = {}
    for q in questions:
        if q.excluded:
            reasons.setdefault(q.excluded, []).append(q.number)
    for reason, nums in sorted(reasons.items()):
        print(f"  除外 {reason}: {len(nums)}件 {nums}")
    warned = [(q.number, w) for q in questions for w in q.warnings]
    if warned:
        print(f"  ⚠️ 要確認: {warned}")
    print(f"→ 採用 {sum(1 for q in questions if not q.excluded)} 件")

    wanted = {int(n) for n in args.show.split(",") if n.strip()}
    for q in questions:
        if q.number in wanted:
            print(f"\n===== 問{q.number} 除外={q.excluded} =====")
            if q.shared_context:
                print(f"[共通文]\n{q.shared_context}\n")
            print(q.text)
            for i, c in enumerate(q.choices, 1):
                print(f"  {i}. {c}")


if __name__ == "__main__":
    main()
