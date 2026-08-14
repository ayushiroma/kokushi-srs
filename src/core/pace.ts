import { addDays, dateOf } from './date'
import { isMastered } from './srs'
import { buildStates } from './state'
import type { ReviewEntry } from './types'

export const MIN_STUDY_DAYS = 3
export const CAPACITY_WINDOW_DAYS = 7

export function measuredCapacity(entries: ReviewEntry[]): number | null {
  const perDay = new Map<string, number>()
  for (const e of entries) {
    const d = dateOf(e.at)
    perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }
  const days = [...perDay.keys()].sort().reverse().slice(0, CAPACITY_WINDOW_DAYS)
  if (days.length < MIN_STUDY_DAYS) return null
  const total = days.reduce((sum, d) => sum + (perDay.get(d) ?? 0), 0)
  return Math.round(total / days.length)
}

export function masteredCountAsOf(entries: ReviewEntry[], examDate: string, asOf: string): number {
  const upTo = entries.filter((e) => dateOf(e.at) <= asOf)
  let count = 0
  for (const state of buildStates(upTo).values()) {
    if (isMastered(state, examDate)) count++
  }
  return count
}

export function masteryPerDay(
  entries: ReviewEntry[],
  examDate: string,
  today: string,
  windowDays = 14,
): number | null {
  const gained =
    masteredCountAsOf(entries, examDate, today) -
    masteredCountAsOf(entries, examDate, addDays(today, -windowDays))
  if (gained <= 0) return null
  return gained / windowDays
}
