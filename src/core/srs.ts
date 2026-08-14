import { addDays, dateOf } from './date'
import type { QuestionState, ReviewEntry } from './types'

export const INTERVALS: readonly number[] = [1, 3, 7, 14, 30, 60]

export function applyReview(prev: QuestionState | null, entry: ReviewEntry): QuestionState {
  const prevIndex = prev ? prev.intervalIndex : -1
  let intervalIndex: number
  let streak: number

  if (entry.result === 'wrong') {
    intervalIndex = 0
    streak = 0
  } else if (entry.result === 'vague') {
    intervalIndex = prevIndex < 0 ? 0 : prevIndex
    streak = 0
  } else {
    intervalIndex = Math.min(prevIndex + 1, INTERVALS.length - 1)
    streak = (prev ? prev.streak : 0) + 1
  }

  return {
    id: entry.id,
    reviews: (prev ? prev.reviews : 0) + 1,
    streak,
    intervalIndex,
    lastAt: entry.at,
    nextDue: addDays(dateOf(entry.at), INTERVALS[intervalIndex]),
  }
}

export function isMastered(s: QuestionState, examDate: string): boolean {
  return s.streak >= 2 && s.nextDue > examDate
}
