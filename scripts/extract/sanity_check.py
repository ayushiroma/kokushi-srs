import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).parent))
from extract import analyze, repair_for

MATERIALS = Path(r"G:\マイドライブ\010_プロダクト開発\040_国試対策\過去問素材")

TARGETS = [
    (111, "am"), (111, "pm"),
    (112, "am"), (112, "pm"),
    (113, "am"), (113, "pm"),
    (114, "am"), (114, "pm"),
    (115, "am"), (115, "pm"),
]

issues = []
total = 0
for round_no, session in TARGETS:
    session_ja = "午前" if session == "am" else "午後"
    qpdf = MATERIALS / "看護師国試" / f"第{round_no}回看護師国家試験_{session_ja}_問題.pdf"
    mapping = repair_for(qpdf.name)
    doc = pymupdf.open(qpdf)
    questions = analyze(doc, 120, mapping)
    for q in questions:
        if q.excluded:
            continue
        total += 1
        whole = f"{q.shared_context or ''}\n{q.text}\n{chr(10).join(q.choices)}"
        if whole.count("〈") != whole.count("〉"):
            issues.append((f"{round_no}-{session}-{q.number}", "括弧の数が不一致", whole[:200]))
            continue
        # 〈〉の中身が長すぎる／短すぎる、ネストしている等を検知
        import re
        for m in re.finditer(r"〈([^〈〉]*)〉", whole):
            content = m.group(1)
            if len(content) > 80:
                issues.append((f"{round_no}-{session}-{q.number}", f"括弧の中身が長すぎる({len(content)}字)", content[:100]))
            if content.strip() == "":
                issues.append((f"{round_no}-{session}-{q.number}", "括弧の中身が空", whole[:200]))
        if "〈〈" in whole or "〉〉" in whole:
            issues.append((f"{round_no}-{session}-{q.number}", "括弧が連続", whole[:200]))

print(f"検査対象 {total} 問 / 疑わしい 件数 {len(issues)}")
for qid, reason, sample in issues[:40]:
    print(f"  {qid}: {reason} -- {sample!r}")
