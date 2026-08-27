# -*- coding: utf-8 -*-
"""Vaultの問題ノート（完成データ）の健全性をまとめて検査する。

`sanity_check.py` がPDF抽出時の検査なのに対し、こちらは**でき上がった問題ノート**を検査する。

2026-08-27の配布前レビューで、既存の検知をすり抜けた破損が34ファイル57箇所見つかった。
すり抜けた理由は「知らない文字コードが残っているか」しか見ていなかったため。
今回の破損は袷・安・案・庵という**実在する正しい漢字**に化けていたので反応しなかった。
そこでこのスクリプトは**文脈で見る**（括弧の中身・漢字語の途中の異物・選択肢行の中身）。

    py -3 vault_check.py            全チェック
    py -3 vault_check.py --quiet    件数と問題だけ出力

終了コード: 問題が1件でもあれば 1
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pymupdf

VAULT = Path(r"G:\マイドライブ\000_My Obsidian\国試対策\データ\問題")
PDF_ROOT = Path(r"G:\マイドライブ\010_プロダクト開発\040_国試対策\過去問素材")
MISSING_DOC = Path(r"G:\マイドライブ\010_プロダクト開発\040_国試対策\docs\2026-08-27-過去問の未収録リスト.md")
ALLOW_PATH = Path(__file__).parent / "vault_check_allow.json"

EXAMS = {
    "nurse": ("看護師国試", "看護師国家試験", [111, 112, 113, 114, 115], {"am": 120, "pm": 120}),
    "phn": ("保健師国試", "保健師国家試験", [108, 109, 110, 111, 112], {"am": 55, "pm": 55}),
}

# 「確認のうえ化けではない」と判断した並び。追加は目視確認したものだけ（vault_check_allow.json 参照）
_allow = json.loads(ALLOW_PATH.read_text(encoding="utf-8")) if ALLOW_PATH.exists() else {}
ALLOW_LATIN = set(_allow.get("latin_ok", []))
ALLOW_DIGIT = set(_allow.get("digit_ok", []))
# 直前の1文字を問わず許可する並び（「A市」「6強」など、前が何であっても正当なもの）
ALLOW_LATIN_TAIL = set(_allow.get("latin_tail_ok", []))
ALLOW_DIGIT_TAIL = set(_allow.get("digit_tail_ok", []))
# 英数字に挟まれても自然な漢字（助数詞・単位）
ALLOW_UNIT = set(_allow.get("unit_ok", []))
# 医学用語の正字体。日本語として正しいので誤字扱いしない
OK_KANJI = set(_allow.get("kanji_ok", []))
# 括弧内に漢字1文字が来ても自然なもの
OK_PAREN = set(_allow.get("paren_ok", []))
# 漢字＋数字＋漢字 で自然な並びになる助数詞など
SKIP_AFTER_DIGIT = set(
    "年月日回歳時分秒人件度割型期次号位側本個階級種項条章部色等以週名床枚杯滴群価相音指横拍世万千億"
    "つのでにとはをがもかまルグ大中小肋誘趾腰胸頸尖職段文交心番食剤管症"
)

problems = []


def report(kind, qid, detail=""):
    problems.append((kind, qid, detail))


def load_notes():
    notes = {}
    for p in sorted(VAULT.rglob("*.md")):
        m = re.match(r"^(nurse|phn)-(\d+)-(am|pm)-(\d+)$", p.stem)
        if not m:
            report("ID形式が不正", p.stem, str(p))
            continue
        t = p.read_text(encoding="utf-8")
        fm = re.match(r"^---\n(.*?)\n---\n", t, re.S)
        ans = []
        if fm:
            a = re.search(r"^answer:\s*(.+)$", fm.group(1), re.M)
            if a:
                ans = sorted(int(n) for n in re.findall(r"\d+", a.group(1)))
        head = re.search(r"^# .*?$(.*?)```kokushi", t, re.S | re.M)
        em = re.search(r"> \[!解説\]-.*?\n((?:>.*\n?)*)", t)
        notes[p.stem] = {
            "path": p,
            "text": t,
            "answer": ans,
            "question": head.group(1) if head else "",
            "expl": re.sub(r"^>\s?", "", em.group(1), flags=re.M).strip() if em else "",
            "key": (m.group(1), int(m.group(2)), m.group(3), int(m.group(4))),
        }
    return notes


LABEL = re.compile(r"^(?:(AM|PM)(\d{1,3})|(A|B)(\d{3}))$")


def parse_answer_pdf(path):
    """正答値表を {(session, num): [正答トークン,...]} に変換する。
    空リスト = 正答欄が空欄 = 厚労省の採点除外問題。
    ラベルは AM1 形式（新しい回）と A001 形式（古い回）の2種類がある。"""
    doc = pymupdf.open(str(path))
    toks = []
    for pg in doc:
        toks.extend(pg.get_text().split())
    out, cur = {}, None
    for tk in toks:
        m = LABEL.match(tk)
        if m:
            cur = (
                (m.group(1).lower(), int(m.group(2)))
                if m.group(1)
                else ("am" if m.group(3) == "A" else "pm", int(m.group(4)))
            )
            out[cur] = []
        elif cur is not None and re.fullmatch(r"\d{1,4}", tk):
            out[cur].append(tk)
        elif cur is not None and out[cur]:
            cur = None
    return out


def check_answers(notes):
    official = {}
    for exam, (folder, jp, rounds, _) in EXAMS.items():
        for rd in rounds:
            for (sess, num), val in parse_answer_pdf(PDF_ROOT / folder / f"第{rd}回{jp}_正答.pdf").items():
                official[(exam, rd, sess, num)] = val

    for qid, n in notes.items():
        val = official.get(n["key"])
        if val is None:
            report("正答値表に該当なし", qid)
            continue
        if not val:
            report("採点除外問題がVaultに入っている", qid, "公式正答が空欄＝演習に使えない")
            continue
        alts = [sorted(set(int(c) for c in v)) for v in val]
        ok = n["answer"] in alts
        if not ok and len(val) > 1 and all(len(v) == 1 for v in val):
            # 複数正答（いずれも正解）を「Nつ選べ」に統合する運用
            ok = n["answer"] == sorted({int(v) for v in val})
        if not ok and "改題" not in n["text"][:400]:
            report("公式正答と不一致（改題マークなし）", qid, f"公式={'/'.join(val)} Vault={n['answer']}")


def check_corruption(notes):
    """文脈で見る化け検知。文字コードでは捕まらない破損を狙う。"""
    for qid, n in notes.items():
        q = re.sub(r"^[0-9]\. ", "", n["question"], flags=re.M)

        # ① 括弧の中身が漢字1文字（検査結果の ＋ － ± が漢字に化ける）
        for m in re.finditer(r"（([一-龥])）", q):
            if m.group(1) not in OK_PAREN:
                report("括弧の中身が漢字1文字（化けの疑い）", qid, q[max(0, m.start() - 24) : m.start() + 12])

        # ② 語の途中にラテン大文字（腿 → W / B のような化け）
        # 直前はひらがな・カタカナのこともある（「…とW痛」など）ので広めに取る
        for m in re.finditer(r"[ぁ-んァ-ヶ一-龥][A-Z][一-龥]", q):
            if m.group(0) in ALLOW_LATIN or m.group(0)[1:] in ALLOW_LATIN_TAIL:
                continue
            report("語中のラテン大文字（化けの疑い）", qid, q[max(0, m.start() - 24) : m.start() + 16])

        # ③ 語の途中に数字（疼 → 2、倦 → 7 のような化け）
        for m in re.finditer(r"[ぁ-んァ-ヶ一-龥][0-9][一-龥]", q):
            if m.group(0)[2] in SKIP_AFTER_DIGIT or m.group(0) in ALLOW_DIGIT or m.group(0)[1:] in ALLOW_DIGIT_TAIL:
                continue
            report("語中の数字（化けの疑い）", qid, q[max(0, m.start() - 24) : m.start() + 16])

        # ④ 英数字に挟まれた漢字1文字（× → 庵 のような記号の化け）
        for m in re.finditer(r"[0-9a-zA-Z]([一-龥])[0-9a-zA-Z]", q):
            if m.group(1) in ALLOW_UNIT:
                continue
            report("英数字に挟まれた漢字（記号の化けの疑い）", qid, q[max(0, m.start() - 22) : m.start() + 18])

        # ⑤ 選択肢の行に別の問題が流れ込んでいる（2問が1ファイルに融合）
        for line in q.split("\n"):
            if not re.match(r"^[1-5]\. ", line):
                continue
            if len(re.findall(r"[１-５][．.]", line)) >= 2:
                report("選択肢行に別の問題が流れ込んでいる", qid, line[:110])
            elif len(line) > 90 and re.search(r"(どれか|選べ)[。．]", line):
                report("選択肢行が長く設問文を含む（融合の疑い）", qid, line[:110])

        # ⑥ 日本語で使われない漢字（簡体字など）／英単語の混入
        for i, ch in enumerate(n["text"]):
            if "\u4e00" <= ch <= "\u9fff" and ch not in OK_KANJI:
                try:
                    ch.encode("cp932")
                except UnicodeEncodeError:
                    report("日本語にない漢字（簡体字等）", qid, n["text"][max(0, i - 20) : i + 20].replace("\n", " "))
        for m in re.finditer(
            r"[ぁ-んァ-ヶ一-龥]\s?(child|answer|family|support|patient|mother)\s?[ぁ-んァ-ヶ一-龥]", n["text"]
        ):
            report("日本語に英単語が混入", qid, n["text"][max(0, m.start() - 20) : m.start() + 34].replace("\n", " "))


def check_consistency(notes):
    for qid, n in notes.items():
        q, e, ans = n["question"], n["expl"], n["answer"]

        if len(e) < 40:
            report("解説が空・極端に短い", qid, f"{len(e)}字")

        m = re.search(r"\*\*正答：([0-9、,・と\s]+)", e)
        if not m:
            report("解説に「正答：◯」行がない", qid)
        else:
            nums = sorted(int(x) for x in re.findall(r"\d", m.group(1)))
            if nums != ans:
                report("解説の正答表記とanswerが不一致", qid, f"解説={nums} answer={ans}")

        two = re.search(r"([2２二三四五])つ選べ", q)
        if two and len(ans) < 2:
            report("「Nつ選べ」なのにanswerが1個", qid)
        if not two and len(ans) >= 2:
            report("answerが複数なのに問題文に「Nつ選べ」がない", qid, f"answer={ans}")

        opts = {int(x) for x in re.findall(r"^([1-5])\. ", q, re.M)}
        if not opts:
            report("選択肢が読み取れない", qid)
        elif [a for a in ans if a not in opts]:
            report("answerが選択肢の範囲外", qid, f"answer={ans} 選択肢={sorted(opts)}")

        for m in re.finditer(r"^-\s*([1-5])[\.．]\s*(正答|正しい)", e, re.M):
            if int(m.group(1)) not in ans:
                report("解説がanswer外の番号を正答扱い", qid, m.group(0))


def check_missing(notes):
    """欠番が「未収録リスト」に載っているかを見る。載っていなければ取りこぼしの疑い。"""
    have = defaultdict(set)
    for n in notes.values():
        exam, rd, sess, num = n["key"]
        have[(exam, rd, sess)].add(num)
    known = set()
    if MISSING_DOC.exists():
        known = set(re.findall(r"`((?:nurse|phn)-\d+-(?:am|pm)-\d+)`", MISSING_DOC.read_text(encoding="utf-8")))
    for exam, (_, _, rounds, sn) in EXAMS.items():
        for rd in rounds:
            for sess, n in sn.items():
                for num in sorted(set(range(1, n + 1)) - have[(exam, rd, sess)]):
                    qid = f"{exam}-{rd}-{sess}-{num:03d}"
                    if qid not in known:
                        report("未収録リストに載っていない欠番", qid, "取りこぼしの可能性。PDFで確認すること")


def main():
    notes = load_notes()
    check_answers(notes)
    check_corruption(notes)
    check_consistency(notes)
    check_missing(notes)

    print(f"検査対象: {len(notes)}問")
    if not problems:
        print("問題なし（全チェッククリーン）")
        return 0
    print(f"\n問題 {len(problems)}件")
    for k, v in Counter(k for k, _, _ in problems).most_common():
        print(f"  {k}: {v}件")
    print()
    for k, qid, d in problems:
        print(f"  [{k}] {qid}  {d}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
