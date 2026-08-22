import { NURSE_FIELDS, PHN_FIELDS } from './fields'
import type { Filter } from './filter'

/** プルダウンの選択状態。空文字は「すべて」を意味する */
export interface Selection {
  exam: string
  field: string
  type: string
  status: string
  round: string
}

export const EMPTY_SELECTION: Selection = { exam: '', field: '', type: '', status: '', round: '' }

/** 試験に対応する分野の一覧。試験を選んでいなければ両方を重複なしで返す */
export function fieldOptionsFor(exam: string): readonly string[] {
  if (exam === 'nurse') return NURSE_FIELDS
  if (exam === 'phn') return PHN_FIELDS
  return [...new Set([...NURSE_FIELDS, ...PHN_FIELDS])]
}

export function buildFilterFromSelection(selection: Selection, limit = 500): Filter {
  const filter: Filter = { limit, unknownKeys: [] }
  if (selection.exam !== '') filter.exam = selection.exam
  if (selection.field !== '') filter.field = selection.field
  if (selection.type !== '') filter.type = selection.type
  if (selection.status !== '') filter.status = selection.status
  const round = Number(selection.round)
  if (selection.round !== '' && !Number.isNaN(round)) filter.round = round
  return filter
}
