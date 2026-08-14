export type Result = 'ok' | 'vague' | 'wrong'

export interface ReviewEntry {
  id: string
  at: string
  result: Result
  reason?: string
}

export interface QuestionState {
  id: string
  reviews: number
  streak: number
  intervalIndex: number
  lastAt: string
  nextDue: string
}
