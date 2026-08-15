"""手作業で検証済みの10問と、抽出結果が一致するか照合する。

10問はPDFを人が読んで作ったもの。抽出器がこれを再現できないなら、
残り541問も信用できない。書き出す前に必ず通す。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).parent))
from extract import analyze, parse_answers  # noqa: E402

MATERIALS = Path(r"G:\マイドライブ\010_プロダクト開発\040_国試対策\過去問素材")
VAULT = Path(r"G:\マイドライブ\000_My Obsidian\国試対策\問題")

SOURCES = {
    ("nurse", 115, "am"): ("看護師国試", "第115回看護師国家試験_午前", 120),
    ("phn", 112, "am"): ("保健師国試", "第112回保健師国家試験_午前", 55),
}


def existing_notes() -> dict[tuple[str, int, str, int], tuple[str, list[str], list[int]]]:
    """既存ノートから 問題文・選択肢・正答 を読み出す。"""
    out = {}
    for path in sorted(VAULT.rglob("*.md")):
        text = path.read_text(encoding="utf-8")
        fm = re.search(r"^---\n(.*?)\n---\n", text, re.S)
        if not fm:
            continue
        meta = dict(
            re.findall(r"^(\w+):\s*(.*)$", fm.group(1), re.M)
        )
        if meta.get("explanation_source") == "none":
            continue  # 今回生成したものは対象外
        body = text[fm.end():]
        body = re.sub(r"^#.*$", "", body, count=1, flags=re.M)
        stem_part = body.split("```kokushi")[0]
        choices = re.findall(r"^\d+\.\s*(.+)$", stem_part, re.M)
        stem = re.sub(r"^\d+\.\s*.+$", "", stem_part, flags=re.M).strip()
        answer = [int(a) for a in re.findall(r"\d+", meta.get("answer", ""))]
        key = (meta["exam"], int(meta["round"]), meta["session"], int(meta["number"]))
        out[key] = (stem, choices, answer)
    return out


def main() -> None:
    notes = existing_notes()
    print(f"検証済みノート {len(notes)} 件と照合します\n")
    ok = ng = 0
    for (exam, round_no, session), (folder, prefix, total) in SOURCES.items():
        doc = pymupdf.open(MATERIALS / folder / f"{prefix}_問題.pdf")
        questions = {q.number: q for q in analyze(doc, total)}
        label = "看護師" if exam == "nurse" else "保健師"
        answers = parse_answers(MATERIALS / folder / f"第{round_no}回{label}国家試験_正答.pdf")

        for key, (stem, choices, answer) in notes.items():
            if key[:3] != (exam, round_no, session):
                continue
            number = key[3]
            q = questions.get(number)
            if q is None:
                print(f"❌ 問{number}: 抽出できていない")
                ng += 1
                continue

            issues = []
            got_stem = q.text.replace("\n\n", "\n").strip()
            want_stem = stem.replace("\n\n", "\n").strip()
            if got_stem != want_stem:
                issues.append(f"問題文\n    抽出: {got_stem!r}\n    既存: {want_stem!r}")
            if q.choices != choices:
                for i, (g, w) in enumerate(zip(q.choices, choices), 1):
                    if g != w:
                        issues.append(f"選択肢{i}\n    抽出: {g!r}\n    既存: {w!r}")
                if len(q.choices) != len(choices):
                    issues.append(f"選択肢の数 抽出{len(q.choices)} / 既存{len(choices)}")
            got_answer = [int(c) for token in answers.get(f"{session}-{number}", []) for c in token]
            if got_answer != answer:
                issues.append(f"正答 抽出{got_answer} / 既存{answer}")

            if issues:
                ng += 1
                print(f"❌ {exam}-{round_no}-{session}-{number:03d}")
                for issue in issues:
                    print(f"  {issue}")
            else:
                ok += 1
                print(f"✅ {exam}-{round_no}-{session}-{number:03d}")

    print(f"\n一致 {ok} / 不一致 {ng}")
    sys.exit(1 if ng else 0)


if __name__ == "__main__":
    main()
