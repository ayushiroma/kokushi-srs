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
