import { isMastered } from './srs'
import type { QuestionState } from './types'

export interface WeaknessRow {
  key: string
  total: number
  attempted: number
  mastered: number
  weak: number
  untouched: number
  masteryRate: number
}

/**
 * 分野やタグごとに、定着・苦手・未着手の数を集計する。
 *
 * 定着率の分母は total ではなく attempted（解いたことがある数）にする。
 * 50問ある分野で5問しか解いていなければ mastered/total は極端に低く出るが、
 * それは「弱い」のではなく「まだやっていない」だけ。混同すると優先順位を誤る。
 *
 * 並び順は苦手の実数が多い順。「今日10分でどこを潰すか」に直接答えるため。
 */
export function aggregateWeakness(
  items: ReadonlyArray<{ key: string; id: string }>,
  states: Map<string, QuestionState>,
  examDate: string,
): WeaknessRow[] {
  const counts = new Map<string, { total: number; attempted: number; mastered: number; weak: number }>()

  for (const item of items) {
    if (item.key === '') continue
    const row = counts.get(item.key) ?? { total: 0, attempted: 0, mastered: 0, weak: 0 }
    row.total++
    const state = states.get(item.id)
    if (state !== undefined) {
      row.attempted++
      if (isMastered(state, examDate)) row.mastered++
      else if (state.streak === 0) row.weak++
    }
    counts.set(item.key, row)
  }

  const rows: WeaknessRow[] = []
  for (const [key, c] of counts) {
    rows.push({
      key,
      total: c.total,
      attempted: c.attempted,
      mastered: c.mastered,
      weak: c.weak,
      untouched: c.total - c.attempted,
      masteryRate: c.attempted === 0 ? 0 : c.mastered / c.attempted,
    })
  }

  return rows.sort((a, b) => {
    if (a.weak !== b.weak) return b.weak - a.weak
    if (a.masteryRate !== b.masteryRate) return a.masteryRate - b.masteryRate
    return a.key.localeCompare(b.key)
  })
}
