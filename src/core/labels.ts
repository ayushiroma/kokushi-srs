/**
 * 内部の値と、画面に出す言葉の対応表。
 *
 * 「未解答」「定着」はこのシステムが作った言葉で、初めて使う人には通じない。
 * 内部の値は変えずに、画面に出す言葉だけをここで差し替える。
 */
export interface Option {
  value: string
  label: string
}

export const EXAM_OPTIONS: readonly Option[] = [
  { value: '', label: 'すべて' },
  { value: 'nurse', label: '看護師' },
  { value: 'phn', label: '保健師' },
]

export const TYPE_OPTIONS: readonly Option[] = [
  { value: '', label: 'すべて' },
  { value: '必修', label: '必修だけ' },
  { value: '一般', label: '一般だけ' },
]

export const STATUS_OPTIONS: readonly Option[] = [
  { value: '', label: 'すべて' },
  { value: '未解答', label: 'まだ解いてない' },
  { value: '苦手', label: '間違えたことがある' },
  { value: '定着', label: '覚えた' },
]

/** `kokushi-list` の条件キー（`type` `status` 等）を画面に出す言葉に差し替える対応表 */
export const FILTER_KEY_LABELS: Readonly<Record<string, string>> = {
  exam: '試験',
  field: '分野',
  round: '年度',
  session: '時間帯',
  status: '状態',
  tag: 'タグ',
  type: '種別',
}

/**
 * `kokushi-list` の条件値（`nurse` `苦手` 等）を画面に出す言葉に差し替える。
 * 対応表に無い値（分野名・タグ名など、元々日本語のもの）はそのまま返す。
 */
export function formatFilterValue(key: string, value: string): string {
  if (key === 'exam') return EXAM_OPTIONS.find((o) => o.value === value)?.label ?? value
  if (key === 'type') return TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
  if (key === 'status') return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
  if (key === 'session') return value === 'am' ? '午前' : value === 'pm' ? '午後' : value
  if (key === 'round') return `第${value}回`
  return value
}
