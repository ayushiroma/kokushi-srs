"""化けた文字の「見本シート」を作る。

推測で埋めると偽の国試問題ができるので、字形を実際にレンダリングして目で確認する。
**問題本文で実際に使われている文字だけ**を対象にする（注意事項ページの化けは
抽出対象外なので直す必要がない）。
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

import pymupdf

from extract import FRONT_MATTER_RE, HEADER_RE

OUT = Path(r"C:\Users\shiro\AppData\Local\Temp\claude\G---------010---------040-----\2804c321-8435-4640-aa8c-5c4574cb9d0c\scratchpad")
BASE = Path(r"G:\マイドライブ\010_プロダクト開発\040_国試対策\過去問素材")
ZOOM = 3.2


def is_broken(ch: str) -> bool:
    return ord(ch) < 0x20 and ch not in "\n\r"


def collect(doc: pymupdf.Document) -> dict[str, tuple[int, tuple[float, ...], str]]:
    """化けた文字ごとに、最初に見つかった行の位置と前後の文脈を集める。"""
    found: dict[str, tuple[int, tuple[float, ...], str]] = {}
    for pno, page in enumerate(doc):
        raw = page.get_text()
        if FRONT_MATTER_RE.search(raw):
            continue  # 注意事項・解答用紙見本のページは抽出対象外
        for block in page.get_text("rawdict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(c["c"] for s in line["spans"] for c in s["chars"])
                if HEADER_RE.match(text.strip()):
                    continue
                for code in {c for c in text if is_broken(c)}:
                    if code not in found:
                        found[code] = (pno, tuple(line["bbox"]), text)
    return found


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=str, help="過去問素材からの相対パス")
    parser.add_argument("tag", type=str, help="出力画像の名前")
    args = parser.parse_args()

    doc = pymupdf.open(BASE / args.pdf)
    found = collect(doc)
    order = sorted(found, key=lambda c: ord(c))
    print(f"### {Path(args.pdf).name}  本文で化けている文字 {len(order)} 種")
    if not order:
        print("  （直すものなし）")
        return

    strips = []
    for i, code in enumerate(order, 1):
        pno, bbox, text = found[code]
        x0, y0, x1, y1 = bbox
        rect = pymupdf.Rect(max(0, x0 - 4), max(0, y0 - 3), x1 + 4, y1 + 3)
        strips.append(doc[pno].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=rect))
        shown = re.sub(r"[\x00-\x1f]", lambda m: f"【{ord(m.group()):02X}】", text)
        print(f"  {i:2}行目  U+{ord(code):04X}  p.{pno+1}  {shown.strip()[:88]}")

    width = max(p.width for p in strips)
    gap = 12
    sheet = pymupdf.Pixmap(
        pymupdf.csRGB, pymupdf.IRect(0, 0, width, sum(p.height + gap for p in strips)), False
    )
    sheet.clear_with(255)
    y = 0
    for pix in strips:
        pix.set_origin(0, y)
        sheet.copy(pix, pix.irect)
        y += pix.height + gap
    out = OUT / f"specimen_{args.tag}.png"
    sheet.save(out)
    print(f"→ {out.name}")


if __name__ == "__main__":
    main()
