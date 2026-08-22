"""2問だけ通常APIで試して出力を確認する（バッチではなく同期呼び出し、課金は極小）。"""
import os
import sys

from dotenv import load_dotenv
import anthropic

sys.path.insert(0, os.path.dirname(__file__))
from generate_batch import SYSTEM_PROMPT, MODEL, collect_targets  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))
client = anthropic.Anthropic()

targets = collect_targets()
print(f"対象総数: {len(targets)}")

for q in targets[:2]:
    print("=" * 60)
    print(q["id"])
    print("-" * 60)
    user_content = f"問題:\n{q['body']}\n\n正答: {q['answer']}"
    resp = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text")
    print(text)
