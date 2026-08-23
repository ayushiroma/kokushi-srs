import { addDays, dateOf } from './date'
import { isMastered } from './srs'
import { buildStates } from './state'
import type { ReviewEntry } from './types'

export const MIN_STUDY_DAYS = 3
export const CAPACITY_WINDOW_DAYS = 7

/**
 * 1日に何問こなせるかを、直近の実績から見積もる。
 *
 * 数えるのは「記録の件数」ではなく「解いた問題の数」。押し直しやメモの追記で
 * 同じ問題の記録が2件3件になっても1問と数える。ホームの「今日の分 ◯/◯」の
 * 分子（answeredTodayCount）が問題数で数えているので、単位を揃えないと
 * 分母だけが膨らみ、全部解いても終わらない表示になる。
 */
export function measuredCapacity(entries: ReviewEntry[]): number | null {
  const perDay = new Map<string, Set<string>>()
  for (const e of entries) {
    const d = dateOf(e.at)
    const solved = perDay.get(d) ?? new Set<string>()
    solved.add(e.id)
    perDay.set(d, solved)
  }
  const days = [...perDay.keys()].sort().reverse().slice(0, CAPACITY_WINDOW_DAYS)
  if (days.length < MIN_STUDY_DAYS) return null
  const total = days.reduce((sum, d) => sum + (perDay.get(d)?.size ?? 0), 0)
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
