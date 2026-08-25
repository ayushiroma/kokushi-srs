const MEMO_HEADING = /^## メモ\s*$/m

interface SplitResult {
  body: string
  memo: string | null
}

function splitAtMemo(content: string): SplitResult {
  const match = MEMO_HEADING.exec(content)
  if (!match) return { body: content, memo: null }
  return { body: content.slice(0, match.index), memo: content.slice(match.index) }
}

/**
 * 知識ノートを更新するとき、友達が書き足した `## メモ` 欄を消さずに
 * 本文だけ新しい内容へ差し替える。
 *
 * - 友達側に `## メモ` が無ければ（まだ何も書いていない）新データで丸ごと置き換える
 * - 友達のファイルが存在しない（新規ファイル）場合も新データをそのまま使う
 *
 * 前提: `## メモ` は常にファイルの最後のセクションであるとみなす
 * （`## メモ` 以降に別のセクションが続くノート構成は想定していない）。
 */
export function mergeKnowledgeNote(newContent: string, existingContent: string | null): string {
  if (existingContent === null) return newContent
  const existing = splitAtMemo(existingContent)
  if (existing.memo === null) return newContent
  const newBody = splitAtMemo(newContent).body
  return `${newBody.replace(/\n*$/, '')}\n\n${existing.memo}`
}
