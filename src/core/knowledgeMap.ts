import { EXAM_ORDER, examLabel, fieldsOf } from './fields'

/**
 * 知識マップの組み立て。
 *
 * 設計の要点：**知識ノート自身は分野を持たない。** 参照している問題の分野から導く。
 * そのため `[[心不全]]` が「循環器」の問題と「老年看護学」の問題の両方から
 * 参照されていれば、両方の分野に出る。フォルダでは表現できない多重所属が、
 * 手入力ゼロで実現する。
 */

export interface KnowledgeSource {
  exam: string
  field: string
  /** その問題が指している知識ノート名（`[[ ]]` を外したもの） */
  knowledge: string[]
}

export interface FieldGroup {
  field: string
  notes: string[]
}

export interface ExamGroup {
  exam: string
  label: string
  groups: FieldGroup[]
}

/**
 * `[[ノート名]]` からノート名だけを取り出す。
 * 別名（`|`）・見出し（`#`）・ブロック参照（`^`）は落とす。
 * リンク記法でない素の文字列も、そのままノート名として受け付ける。
 */
export function parseWikiLink(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  // 中身が空の `[[]]` も「リンク記法」として扱う（`.+` だと素の文字列に落ちてしまう）
  const match = /^\[\[(.*)\]\]$/.exec(trimmed)
  const inner = (match ? match[1] : trimmed).trim()
  // 別名・見出し・ブロック参照を落とす。`#` は見出しの区切りにしか使われない
  const name = inner.split('|')[0].split('#')[0].split('^')[0].trim()
  return name === '' ? null : name
}

const collator = new Intl.Collator('ja')

/** 定義順の分野を先に、定義に無い分野（誤字・新分類）を後ろに回す並び順を返す */
function orderFields(exam: string, present: Set<string>): string[] {
  const known = fieldsOf(exam).filter((f) => present.has(f))
  const unknown = [...present].filter((f) => !fieldsOf(exam).includes(f)).sort(collator.compare)
  // 定義に無い分野も落とさない。落とすと「解いたのに知識マップに出てこない」になる
  return [...known, ...unknown]
}

export function buildKnowledgeMap(sources: KnowledgeSource[]): ExamGroup[] {
  // exam -> field -> ノート名の集合
  const byExam = new Map<string, Map<string, Set<string>>>()

  for (const source of sources) {
    if (source.field === '') continue
    const names = source.knowledge
      .map(parseWikiLink)
      .filter((n): n is string => n !== null)
    if (names.length === 0) continue

    let byField = byExam.get(source.exam)
    if (byField === undefined) {
      byField = new Map()
      byExam.set(source.exam, byField)
    }
    let notes = byField.get(source.field)
    if (notes === undefined) {
      notes = new Set()
      byField.set(source.field, notes)
    }
    for (const name of names) notes.add(name)
  }

  const exams = [...byExam.keys()].sort((a, b) => {
    const ia = EXAM_ORDER.indexOf(a)
    const ib = EXAM_ORDER.indexOf(b)
    if (ia !== ib) return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib)
    return collator.compare(a, b)
  })

  return exams.map((exam) => {
    const byField = byExam.get(exam) as Map<string, Set<string>>
    return {
      exam,
      label: examLabel(exam),
      groups: orderFields(exam, new Set(byField.keys())).map((field) => ({
        field,
        notes: [...(byField.get(field) as Set<string>)].sort(collator.compare),
      })),
    }
  })
}

/** 知識マップに出てくるノート名の総数（重複を除いた実数） */
export function countUniqueNotes(map: ExamGroup[]): number {
  const seen = new Set<string>()
  for (const exam of map) {
    for (const group of exam.groups) {
      for (const note of group.notes) seen.add(note)
    }
  }
  return seen.size
}
