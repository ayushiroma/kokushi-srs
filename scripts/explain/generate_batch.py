"""
解説が未生成の問題を Anthropic Batch API で一括生成する。
explanation_source: none の問題を全件（看護師・保健師とも）対象にする。
使い方:
  py -3 scripts/explain/generate_batch.py submit   バッチを投げる（.env の ANTHROPIC_API_KEY を使用）
  py -3 scripts/explain/generate_batch.py status <batch_id>   進捗確認
  py -3 scripts/explain/generate_batch.py apply <batch_id>    結果を取得して問題ノートに反映
"""
import glob
import json
import os
import re
import sys

from dotenv import load_dotenv
import anthropic

ROOT = r"G:\マイドライブ\000_My Obsidian\国試対策\問題"
MODEL = "claude-sonnet-5"
STATE_FILE = os.path.join(os.path.dirname(__file__), "batch_state.json")

SYSTEM_PROMPT = """あなたは看護師国家試験の解説を書く専門家です。以下の形式を厳密に守って、与えられた1問の解説を書いてください。

## 出力形式(この形式のみを出力。前置き・後置きの文章は書かない)

**正答の理由を1〜2文で説明**（**正答：問題文中の正答番号**、のような接頭辞は書かない。理由の本文だけ）

- 1. （選択肢1が正しい/誤っている理由を1文で）
- 2. （選択肢2について）
- 3. （選択肢3について）
- 4. （選択肢4について）
（選択肢が5つある場合は5まで）

**まとめとして覚えておくと役立つ一言**（1文、太字）

## 例1

入力: 問題「障害者虐待の防止、障害者の養護者に対する支援等に関する法律〈障害者虐待防止法〉の内容として正しいのはどれか」正答:4 選択肢:1.医療的ケア児の学校への看護師配置 2.助産施設への入所 3.20歳未満の飲酒禁止 4.市町村への通報義務

出力:
障害者虐待防止法は、障害者虐待を発見した者に**市町村への通報義務**を課している。

- 1. 医療的ケア児の学校への看護師配置は「**医療的ケア児支援法**」。児童福祉法ではない
- 2. 助産施設への入所は「**児童福祉法**」。母子保健法は健診・母子健康手帳・保健指導などを定める
- 3. 20歳未満の飲酒禁止は「**二十歳未満ノ者ノ飲酒ノ禁止ニ関スル法律**」。アルコール健康障害対策基本法は対策の基本理念と計画を定めるもの
- 4. 正答

**通報義務は虐待防止法の共通構造**（高齢者虐待防止法・児童虐待防止法も同様）。まとめて覚えると強い。

## 例2

入力: 問題「患者の行動変容を促したのはどれか」正答:2 選択肢:1.自己洞察 2.自己効力感 3.自己中心性 4.自己同一性

出力:
**自己効力感（セルフ・エフィカシー）** は「自分にはそれができる」という**遂行可能感**。バンデューラが提唱した概念で、行動変容の中心的な予測因子とされる。

- 1. 自己洞察は、自分の心の動きや動機に気づくこと。ここでは述べられていない
- 2. 正答
- 3. 自己中心性は、他者の視点を取れない状態（発達段階の用語）
- 4. 自己同一性（アイデンティティ）は「自分とは何者か」の感覚。エリクソンの青年期の課題

自己効力感を高める4つの情報源は、**遂行行動の達成・代理的経験・言語的説得・生理的情動的状態**。看護では「小さな成功体験を積ませる」のが最も効果的とされる。

## 注意

- 正答の選択肢には「正答」とだけ書けばよい（理由は冒頭で述べているため）
- 医療情報として正確であることを最優先する。不確かな細部（具体的な統計値・条文番号・年号）は書かない
- 2つ選べという形式の問題は、正答が複数ある前提で書く
- 出力は日本語。Markdown太字(**)を使う。見出し(#)は使わない
"""


def parse_question(fp):
    with open(fp, "r", encoding="utf-8") as f:
        content = f.read()
    m_id = re.search(r"^id:\s*(\S+)", content, re.M)
    m_answer = re.search(r"^answer:\s*\[(.*?)\]", content, re.M)
    m_expl = re.search(r"^explanation_source:\s*(\S+)", content, re.M)
    # 本文: 見出し行の次から ```kokushi``` の手前まで
    m_body = re.search(r"^# .+?\n\n(.*?)\n\n```kokushi", content, re.S | re.M)
    if not (m_id and m_answer and m_body and m_expl):
        return None
    return {
        "id": m_id.group(1),
        "answer": m_answer.group(1),
        "body": m_body.group(1).strip(),
        "explanation_source": m_expl.group(1),
        "path": fp,
    }


def collect_targets():
    files = glob.glob(ROOT + r"\**\*.md", recursive=True)
    targets = []
    for fp in files:
        q = parse_question(fp)
        if q is None:
            continue
        if q["explanation_source"] != "none":
            continue
        targets.append(q)
    return targets


def cmd_submit():
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))
    client = anthropic.Anthropic()

    targets = collect_targets()
    print(f"対象問題数: {len(targets)}")

    requests = []
    for q in targets:
        user_content = f"問題:\n{q['body']}\n\n正答: {q['answer']}"
        requests.append(
            anthropic.types.message_create_params.MessageCreateParamsNonStreaming(
                custom_id=q["id"],
                params={
                    "model": MODEL,
                    "max_tokens": 1024,
                    "system": SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": user_content}],
                },
            )
        )

    batch = client.messages.batches.create(requests=requests)
    print(f"バッチ投入完了: {batch.id}")

    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump({"batch_id": batch.id, "target_ids": [q["id"] for q in targets]}, f, ensure_ascii=False, indent=2)
    print(f"状態を保存: {STATE_FILE}")


def cmd_status(batch_id):
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))
    client = anthropic.Anthropic()
    batch = client.messages.batches.retrieve(batch_id)
    print(f"status: {batch.processing_status}")
    print(f"counts: {batch.request_counts}")


def cmd_apply(batch_id):
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))
    client = anthropic.Anthropic()
    batch = client.messages.batches.retrieve(batch_id)
    if batch.processing_status != "ended":
        print(f"まだ処理中です: {batch.processing_status}")
        return

    with open(STATE_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)
    id_to_path = {}
    for fp in glob.glob(ROOT + r"\**\*.md", recursive=True):
        q = parse_question(fp)
        if q and q["id"] in state["target_ids"]:
            id_to_path[q["id"]] = fp

    applied = 0
    errors = []
    for result in client.messages.batches.results(batch_id):
        cid = result.custom_id
        if result.result.type != "succeeded":
            errors.append((cid, result.result.type))
            continue
        text = "".join(
            block.text for block in result.result.message.content if block.type == "text"
        ).strip()

        fp = id_to_path.get(cid)
        if fp is None:
            errors.append((cid, "path not found"))
            continue

        with open(fp, "r", encoding="utf-8") as f:
            content = f.read()

        # 「解説はまだ作成していません。」の行を、生成した解説（各行 "> " 付き）に置き換える
        quoted = "\n".join(f"> {line}" if line.strip() else ">" for line in text.split("\n"))
        new_content = content.replace("> 解説はまだ作成していません。", quoted)
        new_content = new_content.replace("explanation_source: none", "explanation_source: ai")

        with open(fp, "w", encoding="utf-8") as f:
            f.write(new_content)
        applied += 1

    print(f"反映件数: {applied}")
    print(f"エラー: {len(errors)}")
    for cid, reason in errors[:20]:
        print(f"  - {cid}: {reason}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "submit":
        cmd_submit()
    elif cmd == "status":
        cmd_status(sys.argv[2])
    elif cmd == "apply":
        cmd_apply(sys.argv[2])
    else:
        print(__doc__)
