export type Result = 'ok' | 'vague' | 'wrong'

export interface ReviewEntry {
  id: string
  at: string
  result: Result
  reason?: string
  /** 利用者が選んだ選択肢番号。誤答傾向の分析用。番号タップ式より前のログには無い */
  chosen?: number[]
}

export interface QuestionState {
  id: string
  reviews: number
  streak: number
  intervalIndex: number
  lastAt: string
  nextDue: string
}
