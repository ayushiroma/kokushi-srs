import type { App } from 'obsidian'

const QUESTIONS_DIR = '国試対策/データ/問題'

export interface QuestionMeta {
  id: string
  path: string
  exam: string
  round: number
  session: string
  number: number
  field: string
  tags: string[]
  /** frontmatter の `knowledge`。`[[ ]]` 付きの生の文字列のまま持つ */
  knowledge: string[]
}

function toStringArray(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

export function indexQuestions(app: App): QuestionMeta[] {
  const metas: QuestionMeta[] = []
  for (const file of app.vault.getMarkdownFiles()) {
    if (!file.path.startsWith(`${QUESTIONS_DIR}/`)) continue
    const fm = app.metadataCache.getFileCache(file)?.frontmatter
    if (!fm || typeof fm.id !== 'string' || fm.id === '') continue
    metas.push({
      id: fm.id,
      path: file.path,
      exam: typeof fm.exam === 'string' ? fm.exam : '',
      round: typeof fm.round === 'number' ? fm.round : 0,
      session: typeof fm.session === 'string' ? fm.session : '',
      number: typeof fm.number === 'number' ? fm.number : 0,
      field: typeof fm.field === 'string' ? fm.field : '',
      tags: Array.isArray(fm.tags) ? fm.tags.filter((t): t is string => typeof t === 'string') : [],
      // 1件だけのときにObsidianが配列でなく文字列で返すことがあるため、両方受ける
      knowledge: toStringArray(fm.knowledge),
    })
  }
  return metas.sort((a, b) => {
    if (a.round !== b.round) return b.round - a.round
    if (a.exam !== b.exam) return a.exam.localeCompare(b.exam)
    if (a.session !== b.session) return a.session.localeCompare(b.session)
    return a.number - b.number
  })
}
