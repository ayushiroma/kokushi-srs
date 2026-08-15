"""抽出した問題をObsidianの問題ノートに書き出す。

**AIは1文字も書かない。** 問題文・選択肢・正答はPDFからの転記のみ。
分野・タグ・知識ノートの紐付けは判断が要るので、ここでは空にしておく。

既にあるファイルは上書きしない（手作業で解説を入れたものを壊さないため）。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).parent))
from extract import analyze, parse_answers, repair_for  # noqa: E402

MATERIALS = Path(r"G:\マイドライブ\010_プロダクト開発\040_国試対策\過去問素材")
VAULT = Path(r"G:\マイドライブ\000_My Obsidian\国試対策\問題")

SESSION_KEY = {"午前": "am", "午後": "pm"}

EXAMS = {
    "nurse": {"dir": "看護師国試", "label": "看護師", "total": 120},
    "phn": {"dir": "保健師国試", "label": "保健師", "total": 55},
}


def build_note(
    *,
    exam: str,
    label: str,
    round_no: int,
    session: str,
    session_ja: str,
    q,
    answer: list[int],
    alternatives: bool,
) -> str:
    joiner = " または " if alternatives else "、"
    front = [
        "---",
        f"id: {exam}-{round_no}-{session}-{q.number:03d}",
        f"exam: {exam}",
        f"round: {round_no}",
        f"session: {session}",
        f"number: {q.number}",
        "field: ",
        "tags: []",
        f"answer: [{', '.join(str(a) for a in answer)}]",
        "knowledge: []",
        f"source: 厚生労働省 第{round_no}回{label}国家試験",
        "explanation_source: none",
        "---",
        "",
        f"# 第{round_no}回 {label} {session_ja}{q.number}",
        "",
    ]
    body: list[str] = []
    if q.shared_context:
        body.append("> [!info] 共通の状況設定")
        for line in q.shared_context.split("\n"):
            body.append(f"> {line}" if line else ">")
        body.append("")
    body.append(q.text)
    body.append("")
    for i, choice in enumerate(q.choices, 1):
        body.append(f"{i}. {choice}")
    body += [
        "",
        "```kokushi",
        "```",
        "",
        "> [!解説]- 解説を開く",
        f"> **正答：{joiner.join(str(a) for a in answer)}**",
        ">",
        "> 解説はまだ作成していません。",
        "",
    ]
    return "\n".join(front + body)


def run(dry_run: bool) -> None:
    written = skipped_existing = 0
    excluded_total: dict[str, int] = {}
    problems: list[str] = []

    for exam, meta in EXAMS.items():
        for qpdf in sorted((MATERIALS / meta["dir"]).glob("*_問題.pdf")):
            m = re.search(r"第(\d+)回.*_(午前|午後)_問題", qpdf.name)
            if not m:
                problems.append(f"ファイル名を解釈できない: {qpdf.name}")
                continue
            round_no, session_ja = int(m.group(1)), m.group(2)
            session = SESSION_KEY[session_ja]

            apdf = qpdf.parent / f"第{round_no}回{meta['label']}国家試験_正答.pdf"
            if not apdf.exists():
                problems.append(f"正答PDFが無い: {apdf.name}")
                continue

            doc = pymupdf.open(qpdf)
            mapping = repair_for(qpdf.name)
            questions = analyze(doc, meta["total"], mapping)

            # 直しきれなかった化け文字が1つでも残っていたら、その回は丸ごと生成しない。
            # 数字が欠けた問題文（「1日50本」→「日50本」）は偽の国試問題になる
            leftover: set[str] = set()
            confirmed = {v for v in (mapping or {}).values() if isinstance(v, str)}
            for q in questions:
                whole = f"{q.shared_context or ''}{q.text}{''.join(q.choices)}"
                leftover |= {
                    c for c in whole if ord(c) < 0x20 and c not in confirmed and c not in "\n\r\t"
                }
            if leftover:
                codes = " ".join(f"U+{ord(c):04X}" for c in sorted(leftover, key=ord))
                problems.append(f"⛔ {qpdf.name}: 化け文字が残っている（{codes}）→ 生成せず")
                continue
            missing = sorted(set(range(1, meta["total"] + 1)) - {q.number for q in questions})
            if missing:
                # 一部だけ取り出して「全部入った」ことにするのが一番危ない。全部か、何も出さないか
                problems.append(
                    f"⛔ {qpdf.name}: {len(missing)}問を取り出せなかった（版面が違う）→ 生成せず"
                )
                continue

            answers = parse_answers(apdf)
            if not answers:
                problems.append(f"⛔ {apdf.name}: 正答表を読めなかった → 生成せず")
                continue

            for q in questions:
                if q.excluded:
                    excluded_total[q.excluded] = excluded_total.get(q.excluded, 0) + 1
                    continue
                values = answers.get(f"{session}-{q.number}")
                if values is None:
                    problems.append(f"{qpdf.name} 問{q.number}: 正答が見つからない")
                    continue
                if not values:
                    excluded_total["削除問題"] = excluded_total.get("削除問題", 0) + 1
                    continue
                # 値が複数トークンに分かれている＝「どちらを選んでも正解」。
                # 1トークンに複数桁＝「2つ選べ」の複数選択
                alternatives = len(values) > 1
                answer = [int(c) for token in values for c in token]
                if any(a < 1 or a > len(q.choices) for a in answer):
                    problems.append(
                        f"⚠️ {qpdf.name} 問{q.number}: 正答 {values} が選択肢{len(q.choices)}個に収まらない → 除外"
                    )
                    continue

                # 試験 → 回 → 時間帯 のフォルダに置く。1問は必ず1か所にしか属さないので
                # フォルダ分けで情報が失われない（知識ノートとは事情が逆）
                folder = VAULT / meta["label"] / f"第{round_no}回" / session_ja
                path = folder / f"{exam}-{round_no}-{session}-{q.number:03d}.md"
                if path.exists():
                    skipped_existing += 1
                    continue
                if not dry_run:
                    folder.mkdir(parents=True, exist_ok=True)
                    path.write_text(
                        build_note(
                            exam=exam,
                            label=meta["label"],
                            round_no=round_no,
                            session=session,
                            session_ja=session_ja,
                            q=q,
                            answer=answer,
                            alternatives=alternatives,
                        ),
                        encoding="utf-8",
                    )
                written += 1

    print(f"{'（試算）' if dry_run else ''}書き出し {written} 件 / 既存を温存 {skipped_existing} 件")
    print("除外:")
    for reason, count in sorted(excluded_total.items(), key=lambda kv: -kv[1]):
        print(f"  {reason}: {count}")
    if problems:
        print("\n要対応:")
        for p in problems:
            print(f"  {p}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="実際に書き出す（既定は試算のみ）")
    args = parser.parse_args()
    run(dry_run=not args.write)
