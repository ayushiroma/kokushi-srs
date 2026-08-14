import { describe, expect, it } from 'vitest'
import { aggregateWeakness } from '../src/core/weakness'
import type { QuestionState } from '../src/core/types'

const EXAM = '2027-02-12'

/** 定着済み（連続2回⭕・次回が試験日より後） */
function mastered(id: string): QuestionState {
  return { id, reviews: 6, streak: 2, intervalIndex: 5, lastAt: '2026-12-20T10:00:00+09:00', nextDue: '2027-02-18' }
}

/** 苦手（直近で間違えた＝streak 0・未定着） */
function weak(id: string): QuestionState {
  return { id, reviews: 3, streak: 0, intervalIndex: 0, lastAt: '2026-12-20T10:00:00+09:00', nextDue: '2026-12-21' }
}

/** 学習中（正解はしているが定着まで届いていない） */
function learning(id: string): QuestionState {
  return { id, reviews: 2, streak: 1, intervalIndex: 1, lastAt: '2026-12-20T10:00:00+09:00', nextDue: '2026-12-23' }
}

describe('aggregateWeakness', () => {
  it('キーごとに集計する', () => {
    const items = [
      { key: '成人看護学', id: 'a' },
      { key: '成人看護学', id: 'b' },
      { key: '母性看護学', id: 'c' },
    ]
    const states = new Map([['a', mastered('a')], ['b', weak('b')]])
    const rows = aggregateWeakness(items, states, EXAM)
    const adult = rows.find((r) => r.key === '成人看護学')!
    expect(adult.total).toBe(2)
    expect(adult.attempted).toBe(2)
    expect(adult.mastered).toBe(1)
    expect(adult.weak).toBe(1)
    expect(adult.untouched).toBe(0)
    expect(adult.masteryRate).toBe(0.5)
  })

  it('未着手を attempted に数えず untouched に入れる', () => {
    const items = [
      { key: '疫学', id: 'a' },
      { key: '疫学', id: 'b' },
      { key: '疫学', id: 'c' },
    ]
    const states = new Map([['a', mastered('a')]])
    const row = aggregateWeakness(items, states, EXAM)[0]
    expect(row.total).toBe(3)
    expect(row.attempted).toBe(1)
    expect(row.untouched).toBe(2)
    expect(row.masteryRate).toBe(1)
  })

  it('苦手の多い順に並ぶ', () => {
    const items = [
      { key: '少ない', id: 'a' },
      { key: '多い', id: 'b' },
      { key: '多い', id: 'c' },
    ]
    const states = new Map([['a', weak('a')], ['b', weak('b')], ['c', weak('c')]])
    expect(aggregateWeakness(items, states, EXAM).map((r) => r.key)).toEqual(['多い', '少ない'])
  })

  it('苦手が同数なら定着率が低いほうを先に出す', () => {
    const items = [
      { key: '定着あり', id: 'a' },
      { key: '定着あり', id: 'b' },
      { key: '定着なし', id: 'c' },
      { key: '定着なし', id: 'd' },
    ]
    const states = new Map([
      ['a', weak('a')],
      ['b', mastered('b')],
      ['c', weak('c')],
      ['d', learning('d')],
    ])
    expect(aggregateWeakness(items, states, EXAM).map((r) => r.key)).toEqual(['定着なし', '定着あり'])
  })

  it('学習中（streakが1以上で未定着）は苦手に数えない', () => {
    const items = [{ key: 'X', id: 'a' }]
    const states = new Map([['a', learning('a')]])
    const row = aggregateWeakness(items, states, EXAM)[0]
    expect(row.weak).toBe(0)
    expect(row.attempted).toBe(1)
    expect(row.mastered).toBe(0)
  })

  it('キーが空文字の項目を無視する', () => {
    const items = [{ key: '', id: 'a' }, { key: 'X', id: 'b' }]
    expect(aggregateWeakness(items, new Map(), EXAM).map((r) => r.key)).toEqual(['X'])
  })

  it('一度も解いていないキーは masteryRate が 0', () => {
    const items = [{ key: 'X', id: 'a' }]
    const row = aggregateWeakness(items, new Map(), EXAM)[0]
    expect(row.masteryRate).toBe(0)
    expect(row.weak).toBe(0)
    expect(row.untouched).toBe(1)
  })

  it('空の入力なら空配列', () => {
    expect(aggregateWeakness([], new Map(), EXAM)).toEqual([])
  })
})
