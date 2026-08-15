"""問題に分野・タグを付ける作業を、小分けにして進めるための道具。

1,675問を一度に読むのは無理なので、200問ずつ小分けにする。
Claudeが `dump` で問題文を読み、分野を決めて JSON に書き、`apply` で反映する。

  py -3 classify.py dump 0        … 0番目の束（200問）の問題文を出す
  py -3 classify.py status        … 分野が入っている割合を見る
  py -3 classify.py apply <json>  … {"nurse-115-am-003": {"field": "基礎医学",
                                     "tags": ["睡眠"]}, ...} を反映する

**フォルダは分野を付け終わってから分野別に組み替える**（reorganize.py）。
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

VAULT = Path(r"G:\マイドライブ\000_My Obsidian\国試対策\問題")
BATCH = 200


def notes() -> list[Path]:
    return sorted(VAULT.rglob("*.md"))


def read_meta(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        return {}, text
    meta = dict(re.findall(r"^(\w+):[ \t]*(.*)$", m.group(1), re.M))
    return meta, text


def stem_of(text: str) -> str:
    """問題文の冒頭だけ。分野を決めるにはこれで足りる。"""
    body = text.split("```kokushi")[0]
    body = re.sub(r"^---\n.*?\n---\n", "", body, flags=re.S)
    body = re.sub(r"^#.*$", "", body, count=1, flags=re.M)
    body = re.sub(r"^>.*$", "", body, flags=re.M)  # 共通の状況設定は畳む
    lines = [l.strip() for l in body.split("\n") if l.strip()]
    return " ".join(lines)[:160]


def cmd_dump(index: int) -> None:
    paths = notes()
    chunk = paths[index * BATCH : (index + 1) * BATCH]
    total = (len(paths) + BATCH - 1) // BATCH
    print(f"# 束 {index + 1}/{total}（{len(chunk)}問 / 全{len(paths)}問）")
    for path in chunk:
        meta, text = read_meta(path)
        if meta.get("field"):
            continue
        print(f"{meta.get('id', path.stem)}\t{stem_of(text)}")


def cmd_status() -> None:
    paths = notes()
    filled = tagged = 0
    by_field: dict[str, int] = {}
    for path in paths:
        meta, _ = read_meta(path)
        field = meta.get("field", "")
        if field:
            filled += 1
            by_field[field] = by_field.get(field, 0) + 1
        if meta.get("tags", "[]") not in ("[]", ""):
            tagged += 1
    print(f"全{len(paths)}問 / 分野あり {filled} / タグあり {tagged}")
    for field, n in sorted(by_field.items(), key=lambda kv: -kv[1]):
        print(f"  {field}: {n}")


def cmd_apply(source: Path) -> None:
    data = json.loads(source.read_text(encoding="utf-8"))
    by_id = {}
    for path in notes():
        meta, text = read_meta(path)
        if meta.get("id"):
            by_id[meta["id"]] = (path, text)

    applied = missing = 0
    for qid, values in data.items():
        if qid not in by_id:
            print(f"⚠️ 見つからない: {qid}")
            missing += 1
            continue
        path, text = by_id[qid]
        if "field" in values:
            text = re.sub(r"^field:.*$", f"field: {values['field']}", text, count=1, flags=re.M)
        if "tags" in values:
            tags = "[" + ", ".join(values["tags"]) + "]"
            text = re.sub(r"^tags:.*$", f"tags: {tags}", text, count=1, flags=re.M)
        path.write_text(text, encoding="utf-8")
        applied += 1
    print(f"反映 {applied} 件 / 見つからず {missing} 件")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("dump")
    d.add_argument("index", type=int)
    sub.add_parser("status")
    a = sub.add_parser("apply")
    a.add_argument("json", type=Path)
    args = parser.parse_args()
    if args.cmd == "dump":
        cmd_dump(args.index)
    elif args.cmd == "status":
        cmd_status()
    else:
        cmd_apply(args.json)
