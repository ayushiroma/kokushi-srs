import { describe, expect, it } from 'vitest'
import { INTERVALS, applyReview, isMastered } from '../src/core/srs'
import type { ReviewEntry, QuestionState } from '../src/core/types'

function entry(result: ReviewEntry['result'], at = '2026-08-14T21:00:00+09:00'): ReviewEntry {
  return { id: 'q1', at, result }
}

describe('applyReview', () => {
  it('初回⭕は1日後', () => {
    const s = applyReview(null, entry('ok'))
    expect(s.nextDue).toBe('2026-08-15')
    expect(s.streak).toBe(1)
    expect(s.reviews).toBe(1)
  })

  it('初回❌も1日後', () => {
    const s = applyReview(null, entry('wrong'))
    expect(s.nextDue).toBe('2026-08-15')
    expect(s.streak).toBe(0)
  })

  it('初回△も1日後', () => {
    const s = applyReview(null, entry('vague'))
    expect(s.nextDue).toBe('2026-08-15')
    expect(s.streak).toBe(0)
  })

  it('⭕を続けると間隔が伸びる', () => {
    let s = applyReview(null, entry('ok', '2026-08-14T21:00:00+09:00'))
    s = applyReview(s, entry('ok', '2026-08-15T21:00:00+09:00'))
    expect(s.nextDue).toBe('2026-08-18')
    s = applyReview(s, entry('ok', '2026-08-18T21:00:00+09:00'))
    expect(s.nextDue).toBe('2026-08-25')
    expect(s.streak).toBe(3)
  })

  it('❌は間隔を1日に戻し連続正解も切る', () => {
    let s = applyReview(null, entry('ok', '2026-08-14T21:00:00+09:00'))
    s = applyReview(s, entry('ok', '2026-08-15T21:00:00+09:00'))
    s = applyReview(s, entry('wrong', '2026-08-18T21:00:00+09:00'))
    expect(s.nextDue).toBe('2026-08-19')
    expect(s.intervalIndex).toBe(0)
    expect(s.streak).toBe(0)
  })

  it('△は間隔を据え置き、連続正解だけ切る', () => {
    let s = applyReview(null, entry('ok', '2026-08-14T21:00:00+09:00'))
    s = applyReview(s, entry('ok', '2026-08-15T21:00:00+09:00'))
    expect(s.intervalIndex).toBe(1)
    s = applyReview(s, entry('vague', '2026-08-18T21:00:00+09:00'))
    expect(s.intervalIndex).toBe(1)
    expect(s.nextDue).toBe('2026-08-21')
    expect(s.streak).toBe(0)
  })

  it('間隔テーブルの上限を超えない', () => {
    let s: QuestionState | null = null
    for (let i = 0; i < 10; i++) {
      s = applyReview(s, entry('ok', '2026-08-14T21:00:00+09:00'))
    }
    expect(s!.intervalIndex).toBe(INTERVALS.length - 1)
    expect(s!.nextDue).toBe('2026-10-13')
  })
})

describe('isMastered', () => {
  const exam = '2027-02-12'

  it('連続2回⭕かつ次回が試験日より後なら定着', () => {
    const s: QuestionState = { id: 'q1', reviews: 6, streak: 2, intervalIndex: 5, lastAt: '2026-12-20T00:00:00+09:00', nextDue: '2027-02-18' }
    expect(isMastered(s, exam)).toBe(true)
  })

  it('連続1回では定着にしない（まぐれ対策）', () => {
    const s: QuestionState = { id: 'q1', reviews: 6, streak: 1, intervalIndex: 5, lastAt: '2026-12-20T00:00:00+09:00', nextDue: '2027-02-18' }
    expect(isMastered(s, exam)).toBe(false)
  })

  it('次回が試験日より前なら定着ではない', () => {
    const s: QuestionState = { id: 'q1', reviews: 6, streak: 3, intervalIndex: 4, lastAt: '2026-12-20T00:00:00+09:00', nextDue: '2027-01-19' }
    expect(isMastered(s, exam)).toBe(false)
  })
})
