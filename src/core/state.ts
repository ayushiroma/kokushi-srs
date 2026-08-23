import { dateOf } from './date'
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

/**
 * 同じ日に同じ問題を何度記録しても、最後の1件だけを残す。
 *
 * ⭕△❌は押し直せる設計で、自動採点のあとに押し直せば2件目、
 * ❌にメモを足せば3件目が追記される。これを1件ずつ復習アルゴリズムに
 * 通すと、1回しか解いていない問題で streak と復習間隔が2段以上進み、
 * 実力より早く「覚えた」判定になる。
 *
 * 間隔反復は「1日1回」が単位なので、同じ日の記録は最後の1件を正とする。
 * これは「押し直したら最後の記録が正」という元々の設計そのもの。
 * ログ自体は消さないので、あとから何をどう直したかは追える。
 *
 * 入力は時系列に並んでいる前提（mergeLogs が保証する）。
 * Mapは同じキーに入れ直しても最初に入った位置を保つので、
 * 問題ごとに見たときの日付の順番は崩れない。
 */
function lastPerDay(entries: ReviewEntry[]): ReviewEntry[] {
  const byIdAndDay = new Map<string, ReviewEntry>()
  for (const entry of entries) {
    byIdAndDay.set(`${entry.id}\t${dateOf(entry.at)}`, entry)
  }
  return [...byIdAndDay.values()]
}

export function buildStates(entries: ReviewEntry[]): Map<string, QuestionState> {
  const states = new Map<string, QuestionState>()
  for (const entry of lastPerDay(entries)) {
    states.set(entry.id, applyReview(states.get(entry.id) ?? null, entry))
  }
  return states
}
