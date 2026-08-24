import { describe, expect, it } from 'vitest'
import { answeredTodayCount } from '../src/core/todayProgress'
import type { ReviewEntry } from '../src/core/types'

const entry = (id: string, at: string): ReviewEntry => ({ id, at, result: 'ok' })

describe('answeredTodayCount', () => {
  it('今日の記録だけを数える', () => {
    const entries = [
      entry('q1', '2026-08-21T23:00:00+09:00'),
      entry('q2', '2026-08-22T09:00:00+09:00'),
      entry('q3', '2026-08-22T10:00:00+09:00'),
    ]
    expect(answeredTodayCount(entries, '2026-08-22')).toBe(2)
  })

  it('同じ問題を押し直しても1件として数える', () => {
    const entries = [
      entry('q1', '2026-08-22T09:00:00+09:00'),
      entry('q1', '2026-08-22T09:01:00+09:00'),
      entry('q1', '2026-08-22T09:02:00+09:00'),
    ]
    expect(answeredTodayCount(entries, '2026-08-22')).toBe(1)
  })

  it('記録が無ければ0', () => {
    expect(answeredTodayCount([], '2026-08-22')).toBe(0)
  })

  it('今日の記録が無ければ0', () => {
    expect(answeredTodayCount([entry('q1', '2026-08-20T09:00:00+09:00')], '2026-08-22')).toBe(0)
  })
})
