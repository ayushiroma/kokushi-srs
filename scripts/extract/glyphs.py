"""壊れた文字を洗い出し、見本シートを作り、対応表を適用する。

**推測で埋めない。** 文字化けした箇所は字形を実際にレンダリングして目で確認し、
`glyphmap.json` に記録した対応表だけを使う。表に無い文字が残っていれば、
その回は生成しない（偽の国試問題を作らないため）。

  py -3 glyphs.py scan                 … 全ファイルの壊れた文字を一覧する
  py -3 glyphs.py sheet <pdf> <tag>    … 見本シート（画像）を作る
  py -3 glyphs.py check                … 対応表の充足を確認する
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pymupdf

from extract import (
    FRONT_MATTER_RE,
    HEADER_RE,
    load_map,
    page_lines,
    repair_brackets,
    repair_chars,
    repair_for,
)

BASE = Path(r"G:\マイドライブ\010_プロダクト開発\040_国試対策\過去問素材")
OUT = Path(r"C:\Users\shiro\AppData\Local\Temp\claude\G---------010---------040-----\2804c321-8435-4640-aa8c-5c4574cb9d0c\scratchpad")

# 埋め込みフォントが壊れていない回。ここに出てくる文字を「正常な文字」の基準にする
CLEAN = [
    "看護師国試/第115回看護師国家試験_午前_問題.pdf",
    "看護師国試/第115回看護師国家試験_午後_問題.pdf",
    "保健師国試/第110回保健師国家試験_午前_問題.pdf",
    "保健師国試/第110回保健師国家試験_午後_問題.pdf",
    "保健師国試/第111回保健師国家試験_午前_問題.pdf",
    "保健師国試/第111回保健師国家試験_午後_問題.pdf",
    "保健師国試/第112回保健師国家試験_午前_問題.pdf",
    "保健師国試/第112回保健師国家試験_午後_問題.pdf",
]

ALL_PDFS = sorted(
    [f"看護師国試/{p.name}" for p in (BASE / "看護師国試").glob("*_問題.pdf")]
    + [f"保健師国試/{p.name}" for p in (BASE / "保健師国試").glob("*_問題.pdf")]
)


def body_text_lines(doc: pymupdf.Document) -> list[tuple[int, tuple[float, ...], str]]:
    """問題本文のページの行を (ページ番号, 位置, 文字列) で返す。

    注意事項・解答用紙見本のページは抽出対象外なので、そこの文字化けは直さなくてよい。
    """
    out = []
    for pno, page in enumerate(doc):
        if FRONT_MATTER_RE.search(page.get_text()):
            continue
        for block in page.get_text("rawdict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(c["c"] for s in line["spans"] for c in s["chars"])
                if HEADER_RE.match(text.strip()):
                    continue
                out.append((pno, tuple(line["bbox"]), text))
    assert page_lines is not None  # extract.page_lines と同じ切り方をしている
    return out


def reference_charset() -> set[str]:
    chars: set[str] = set()
    for name in CLEAN:
        for _, _, text in body_text_lines(pymupdf.open(BASE / name)):
            chars.update(text)
    return chars


def is_latin(ch: str) -> bool:
    return ch.isascii() and ch.isalpha()


def is_cjk_char(ch: str) -> bool:
    if ch == "":
        return False
    o = ord(ch)
    return 0x3040 <= o <= 0x30FF or 0x4E00 <= o <= 0x9FFF or 0x3005 <= o <= 0x3006


def symbol_baseline() -> set[str]:
    """正常な回で実際に使われている記号の一覧。

    Latin-1 を一律に「化け」と見なすのは誤り。正常な回にも `×` `÷` `ö`（Sjögren）
    `ü` `é` は出てくる。**正常な回に一度も出てこない記号だけ**を疑う。
    """
    chars: set[str] = set()
    for name in CLEAN:
        for _, _, text in body_text_lines(pymupdf.open(BASE / name)):
            for ch in text:
                if not (is_cjk_char(ch) or ch.isascii() and ch.isalnum() or ch.isspace()):
                    chars.add(ch)
    return chars


def suspicious(text: str, baseline: set[str]) -> set[str]:
    """化けている疑いのある文字。

    「正常な回に出てこない文字」だけで判定すると、珍しい漢字（勉・君・百・飛）
    まで拾ってしまう。壊れ方の実体に即して2種類だけを見る:

      ① 制御文字（U+0000〜001F）… 数字や漢字が落ちる。最も危険
      ② 正常な回に一度も出てこない記号 … 括弧の置き換え（`!` `?` `{` `ï` `Ù` など）

    ラテン文字が括弧の代わりに使われている場合（`Kaup?カウプC指数` の `C`）は
    文字単体では判別できないので、括弧の数が合っているかで別に検出する。
    """
    out: set[str] = set()
    for ch in text:
        if ord(ch) < 0x20:
            out.add(ch)
        elif is_cjk_char(ch) or ch.isspace() or (ch.isascii() and ch.isalnum()):
            continue
        elif ch not in baseline:
            out.add(ch)
    return out


def bracket_substitutes(lines: list[str]) -> dict[str, int]:
    """括弧の代わりに使われているラテン文字を見つける。

    本来のラテン文字は英単語の中にある（`COPD` `cm`）。括弧の代役は
    **前後がどちらも和文**という形で孤立して現れる。この違いで見分ける。
    """
    counts: dict[str, int] = {}
    for text in lines:
        for i, ch in enumerate(text):
            if not is_latin(ch):
                continue
            prev = text[i - 1] if i > 0 else ""
            nxt = text[i + 1] if i + 1 < len(text) else ""
            if is_latin(prev) or is_latin(nxt):
                continue  # 英単語の一部
            if is_cjk_char(prev) or is_cjk_char(nxt):
                counts[ch] = counts.get(ch, 0) + 1
    return {c: n for c, n in counts.items() if n >= 5}


def file_report(name: str, baseline: set[str]) -> tuple[dict[str, int], dict[str, int]]:
    lines = [text for _, _, text in body_text_lines(pymupdf.open(BASE / name))]
    bad: dict[str, int] = {}
    for text in lines:
        for c in suspicious(text, baseline):
            bad[c] = bad.get(c, 0) + text.count(c)
    whole = "\n".join(lines)
    pairs = {ch: whole.count(ch) for ch in "（）〈〉「」｢｣"}
    return bad, pairs


def cmd_scan() -> None:
    baseline = symbol_baseline()
    table = load_map()
    print(f"正常な回で使われている記号: {len(baseline)}種\n")
    for name in ALL_PDFS:
        bad, pairs = file_report(name, baseline)
        known = table.get(Path(name).stem, {})
        missing = sorted((c for c in bad if f"{ord(c):04X}" not in known), key=ord)
        codes = " ".join(f"U+{ord(c):04X}({bad[c]})" for c in missing)
        # 括弧が片方しか無い＝代役が紛れている。ラテン文字が代役の場合ここで気づく
        lost = [
            f"{a}{b}"
            for a, b in ("（）", "〈〉", "「」")
            if pairs[a] == 0 and pairs[b] == 0
        ]
        print(f"{Path(name).stem[:26]:28} {'OK' if not missing and not lost else f'未対応{len(missing)}'}")
        if codes:
            print(f"    {codes}")
        if lost:
            print(f"    括弧が丸ごと欠けている: {' '.join(lost)}"
                  f"（｢｣={pairs['｢']}）")


def cmd_sheet(pdf: str, tag: str) -> None:
    baseline = symbol_baseline()
    doc = pymupdf.open(BASE / pdf)
    lines = body_text_lines(doc)
    found: dict[str, tuple[int, tuple[float, ...], str]] = {}
    for pno, bbox, text in lines:
        for c in suspicious(text, baseline):
            if c not in found:
                found[c] = (pno, bbox, text)

    order = sorted(found, key=ord)
    print(f"### {Path(pdf).name}  本文で化けている文字 {len(order)} 種")
    if not order:
        print("  （直すものなし）")
        return

    strips = []
    for i, code in enumerate(order, 1):
        pno, bbox, text = found[code]
        x0, y0, x1, y1 = bbox
        rect = pymupdf.Rect(max(0, x0 - 4), max(0, y0 - 3), x1 + 4, y1 + 3)
        strips.append(doc[pno].get_pixmap(matrix=pymupdf.Matrix(3.2, 3.2), clip=rect))
        shown = "".join(
            f"【{ord(ch):04X}】" if ch in found else ch for ch in text
        )
        print(f"  {i:2}行目  U+{ord(code):04X}  {shown.strip()[:88]}")

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
    sheet.save(OUT / f"specimen_{tag}.png")
    print(f"→ specimen_{tag}.png")


def repair_lines(lines: list[str], mapping: dict[str, str] | None) -> list[str]:
    """行ごとに文字を戻し、そのあとで括弧の対応をとる。

    **行ごとに当てるのが要点。** 化けた文字コードには `U+000A`（改行と同じ値）が
    含まれる回があり、行を繋いだ文字列に当てると改行まで数字に変わってしまう。
    """
    fixed = [repair_chars(line, mapping) for line in lines]
    return [repair_brackets(line, mapping) for line in fixed]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("scan")
    s = sub.add_parser("sheet")
    s.add_argument("pdf")
    s.add_argument("tag")
    args = parser.parse_args()
    if args.cmd == "scan":
        cmd_scan()
    else:
        cmd_sheet(args.pdf, args.tag)
