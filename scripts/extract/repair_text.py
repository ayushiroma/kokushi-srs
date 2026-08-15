"""ルビ注釈の挟み込みバグを直した抽出ロジックで、既存ノートの本文だけを上書きする。

分野・タグ・正答・解説などのfrontmatterはそのまま残す。書き換えるのは
本文（`> [!info] 共通の状況設定` の中身と、設問本文・選択肢）だけ。

使い方:
    py -3 repair_text.py            試算のみ（差分の件数と一部プレビューを表示）
    py -3 repair_text.py --write    実際にノートを書き換える
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).parent))
from extract import analyze, repair_for  # noqa: E402

MATERIALS = Path(r"G:\マイドライブ\010_プロダクト開発\040_国試対策\過去問素材")
VAULT = Path(r"G:\マイドライブ\000_My Obsidian\国試対策\問題")

# 看護師111〜114回はルビ形式の読み仮名で単語の途中に挟み込まれる致命的なバグがあった。
# 第115回も同じルビ構造（英語が本文より小さいフォントで別行）を使っているが、
# 単語を分断しない位置にあったため見た目は壊れていなかった。2026-08-15、
# あゆさんの判断で表記スタイルを統一するため対象に追加（括弧あり `〈diabetes mellitus〉`）。
# 表記スタイルを揃えるため、保健師（全回で同じルビ構造）も対象に含める。
TARGETS = [
    ("nurse", "看護師", 111, "am", "午前", 120),
    ("nurse", "看護師", 111, "pm", "午後", 120),
    ("nurse", "看護師", 112, "am", "午前", 120),
    ("nurse", "看護師", 112, "pm", "午後", 120),
    ("nurse", "看護師", 113, "am", "午前", 120),
    ("nurse", "看護師", 113, "pm", "午後", 120),
    ("nurse", "看護師", 114, "am", "午前", 120),
    ("nurse", "看護師", 114, "pm", "午後", 120),
    ("nurse", "看護師", 115, "am", "午前", 120),
    ("nurse", "看護師", 115, "pm", "午後", 120),
    ("phn", "保健師", 108, "am", "午前", 55),
    ("phn", "保健師", 108, "pm", "午後", 55),
    ("phn", "保健師", 109, "am", "午前", 55),
    ("phn", "保健師", 109, "pm", "午後", 55),
    ("phn", "保健師", 110, "am", "午前", 55),
    ("phn", "保健師", 110, "pm", "午後", 55),
    ("phn", "保健師", 111, "am", "午前", 55),
    ("phn", "保健師", 111, "pm", "午後", 55),
    ("phn", "保健師", 112, "am", "午前", 55),
    ("phn", "保健師", 112, "pm", "午後", 55),
]

# 自動抽出では直せない（ブラケット代役の文字が本物の英単語と偶然一致する）ため
# 手作業で個別に直した問題。再実行で上書きされないよう除外する。
# nurse-113-pm-092: round113午後の代役 u/x が pneumothorax の中の u/x と衝突し
# `気胸pne〈mothora〉` になる。手作業で `気胸〈pneumothorax〉` に修正済み（2026-08-15）。
MANUAL_OVERRIDES = {"nurse-113-pm-092"}


def build_body(q) -> tuple[str | None, str, list[str]]:
    return q.shared_context, q.text, q.choices


def note_path(exam: str, label: str, round_no: int, session: str, number: int) -> Path | None:
    stem = f"{exam}-{round_no}-{session}-{number:03d}"
    matches = list(VAULT.rglob(f"{stem}.md"))
    return matches[0] if matches else None


def patch_note(path: Path, shared: str | None, text: str, choices: list[str]) -> bool:
    """本文だけを差し替える。差分が無ければFalseを返す。"""
    old = path.read_text(encoding="utf-8")
    m = re.match(r"^(---\n.*?\n---\n\n# [^\n]*\n\n)(.*?)(\n```kokushi\n```\n.*)$", old, re.S)
    if not m:
        print(f"⚠️ 構造を認識できない: {path.name}")
        return False
    head, _old_body, tail = m.groups()

    new_body_lines: list[str] = []
    if shared:
        new_body_lines.append("> [!info] 共通の状況設定")
        for line in shared.split("\n"):
            new_body_lines.append(f"> {line}" if line else ">")
        new_body_lines.append("")
    new_body_lines.append(text)
    new_body_lines.append("")
    for i, choice in enumerate(choices, 1):
        new_body_lines.append(f"{i}. {choice}")
    new_body = "\n".join(new_body_lines) + "\n"

    new_text = head + new_body + tail
    if new_text.strip() == old.strip():
        return False
    path.write_text(new_text, encoding="utf-8")
    return True


def run(dry_run: bool) -> None:
    changed = unchanged = errors = 0
    previews: list[str] = []

    for exam, label, round_no, session, session_ja, total in TARGETS:
        qpdf = MATERIALS / f"{label}国試" / f"第{round_no}回{label}国家試験_{session_ja}_問題.pdf"
        if not qpdf.exists():
            print(f"⚠️ PDFが無い: {qpdf}")
            continue
        doc = pymupdf.open(qpdf)
        mapping = repair_for(qpdf.name)
        questions = analyze(doc, total, mapping)

        for q in questions:
            if q.excluded:
                continue
            stem = f"{exam}-{round_no}-{session}-{q.number:03d}"
            if stem in MANUAL_OVERRIDES:
                continue
            path = note_path(exam, label, round_no, session, q.number)
            if path is None:
                continue
            shared, text, choices = build_body(q)
            old = path.read_text(encoding="utf-8")
            if dry_run:
                # 差分があるかだけ見る（実際の書き込みはしない）
                m = re.match(r"^(---\n.*?\n---\n\n# [^\n]*\n\n)(.*?)(\n```kokushi\n```\n.*)$", old, re.S)
                if not m:
                    errors += 1
                    continue
                _, old_body, _ = m.groups()
                new_body_lines: list[str] = []
                if shared:
                    new_body_lines.append("> [!info] 共通の状況設定")
                    for line in shared.split("\n"):
                        new_body_lines.append(f"> {line}" if line else ">")
                    new_body_lines.append("")
                new_body_lines.append(text)
                new_body_lines.append("")
                for i, choice in enumerate(choices, 1):
                    new_body_lines.append(f"{i}. {choice}")
                new_body = "\n".join(new_body_lines)
                if new_body.strip() != old_body.strip():
                    changed += 1
                    if len(previews) < 15:
                        previews.append(f"{path.stem}")
                else:
                    unchanged += 1
            else:
                if patch_note(path, shared, text, choices):
                    changed += 1
                else:
                    unchanged += 1

    print(f"{'（試算）' if dry_run else ''}差分あり {changed} 件 / 差分なし {unchanged} 件 / 構造エラー {errors} 件")
    if previews:
        print("差分があった例:", ", ".join(previews))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    run(dry_run=not args.write)
