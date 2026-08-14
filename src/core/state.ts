import { applyReview } from './srs'
import type { QuestionState, Result, ReviewEntry } from './types'

/**
 * 問題ごとの「最後にどう答えたか」。
 *
 * `QuestionState` は連続正解数しか持たない（△は連続を切らさない仕様のため、
 * streak > 0 でも直近が△のことがある）。必修の8割判定は直近の出来で見たいので、
 * 最後の1件をそのまま取り出す。ログは時系列に並んでいる前提。
 */
export function latestResults(entries: ReviewEntry[]): Map<string, Result> {
  const latest = new Map<string, Result>()
  for (const entry of entries) latest.set(entry.id, entry.result)
  return latest
}

export function buildStates(entries: ReviewEntry[]): Map<string, QuestionState> {
  const states = new Map<string, QuestionState>()
  for (const entry of entries) {
    states.set(entry.id, applyReview(states.get(entry.id) ?? null, entry))
  }
  return states
}
