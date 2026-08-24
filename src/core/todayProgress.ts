import { dateOf } from './date'
import type { ReviewEntry } from './types'

/**
 * 今日いくつの問題を記録したかを数える。押し直しは1件として数える。
 *
 * 「今日のキューの残り件数」では数えない。buildQueue は復習を1問解くと
 * その分だけ新規問題を補充するため、解いても総数が減らず、
 * 「今日の分が終わった」という状態が永久に来ないため。
 */
export function answeredTodayCount(entries: ReviewEntry[], today: string): number {
  const ids = new Set<string>()
  for (const entry of entries) {
    if (dateOf(entry.at) === today) ids.add(entry.id)
  }
  return ids.size
}
