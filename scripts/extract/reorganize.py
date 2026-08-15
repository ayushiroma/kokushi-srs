"""問題ノートを 試験 → 回 → 時間帯 のフォルダに整理する。

1問は必ず1つの回・1つの時間帯にしか属さないので、フォルダ分けで情報が失われない
（知識ノートをフォルダ分けしないのとは事情が逆）。

Obsidianの `[[リンク]]` はファイル名で解決するので、移動してもリンクは壊れない。
プラグインも `国試対策/問題/` 配下を再帰的に見ているのでコード変更は不要。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

VAULT = Path(r"G:\マイドライブ\000_My Obsidian\国試対策\問題")
EXAM_LABEL = {"nurse": "看護師", "phn": "保健師"}
SESSION_LABEL = {"am": "午前", "pm": "午後"}

ID_RE = re.compile(r"^(nurse|phn)-(\d+)-(am|pm)-(\d+)$")


def target_dir(stem: str) -> Path | None:
    m = ID_RE.match(stem)
    if not m:
        return None
    exam, round_no, session, _ = m.groups()
    return VAULT / EXAM_LABEL[exam] / f"第{round_no}回" / SESSION_LABEL[session]


def main(dry_run: bool) -> None:
    moved = 0
    skipped: list[str] = []
    for path in sorted(VAULT.rglob("*.md")):
        dest_dir = target_dir(path.stem)
        if dest_dir is None:
            skipped.append(path.name)
            continue
        dest = dest_dir / path.name
        if dest == path:
            continue
        if dest.exists():
            skipped.append(f"{path.name}（移動先に同名あり）")
            continue
        if not dry_run:
            dest_dir.mkdir(parents=True, exist_ok=True)
            path.rename(dest)
        moved += 1

    # 空になった元フォルダを片付ける
    if not dry_run:
        for d in sorted(VAULT.rglob("*"), key=lambda p: -len(p.parts)):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()

    print(f"{'（試算）' if dry_run else ''}移動 {moved} 件")
    if skipped:
        print(f"移動しなかったもの {len(skipped)} 件: {skipped[:10]}")

    print("\n--- 整理後 ---")
    for d in sorted(p for p in VAULT.rglob("*") if p.is_dir()):
        files = list(d.glob("*.md"))
        if files:
            print(f"  {d.relative_to(VAULT)}  {len(files)}件")


if __name__ == "__main__":
    main(dry_run="--write" not in sys.argv)
