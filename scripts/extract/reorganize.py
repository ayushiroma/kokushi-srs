"""問題ノートを 試験 → 分野 のフォルダに整理する。

2026-08-15、あゆさんの希望で「試験→回→時間帯」から「試験→分野」に変更。
1問は必ず1つの分野にしか属さない（分野が付いていることが前提）ので、
フォルダ分けで情報が失われない（知識ノートをフォルダ分けしないのとは事情が逆）。

回・時間帯はフォルダでは表現しない。frontmatterの round / session に残るので、
`演習.md` で `round: 115` のように絞り込める。

Obsidianの `[[リンク]]` はファイル名で解決するので、移動してもリンクは壊れない。
プラグインも `国試対策/問題/` 配下を再帰的に見ているのでコード変更は不要。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

VAULT = Path(r"G:\マイドライブ\000_My Obsidian\国試対策\問題")
EXAM_LABEL = {"nurse": "看護師", "phn": "保健師"}


def read_meta(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        return {}
    return dict(re.findall(r"^(\w+):[ \t]*(.*)$", m.group(1), re.M))


def target_dir(meta: dict[str, str]) -> Path | None:
    exam = meta.get("exam", "")
    field = meta.get("field", "")
    if exam not in EXAM_LABEL or not field:
        return None
    return VAULT / EXAM_LABEL[exam] / field


def main(dry_run: bool) -> None:
    moved = 0
    skipped: list[str] = []
    for path in sorted(VAULT.rglob("*.md")):
        meta = read_meta(path)
        dest_dir = target_dir(meta)
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
