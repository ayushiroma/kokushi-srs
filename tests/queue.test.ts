import { describe, expect, it } from 'vitest'
import { buildQueue } from '../src/core/queue'
import type { QuestionState } from '../src/core/types'

function state(id: string, nextDue: string): QuestionState {
  return { id, reviews: 1, streak: 1, intervalIndex: 0, lastAt: '2026-08-13T10:00:00+09:00', nextDue }
}

const allIds = ['a', 'b', 'c', 'd', 'e']

describe('buildQueue', () => {
  it('復習日が今日以前のものを復習に入れる', () => {
    const states = new Map([
      ['a', state('a', '2026-08-13')],
      ['b', state('b', '2026-08-14')],
      ['c', state('c', '2026-08-20')],
    ])
    const q = buildQueue({ allIds, states, today: '2026-08-14', capacity: 10 })
    expect(q.due).toEqual(['a', 'b'])
  })

  it('キャパから復習を引いた残りだけ新規を出す', () => {
    const states = new Map([['a', state('a', '2026-08-14')]])
    const q = buildQueue({ allIds, states, today: '2026-08-14', capacity: 3 })
    expect(q.due).toEqual(['a'])
    expect(q.fresh).toEqual(['b', 'c'])
  })

  it('復習がキャパを超えたら新規はゼロ', () => {
    const states = new Map([
      ['a', state('a', '2026-08-14')],
      ['b', state('b', '2026-08-14')],
      ['c', state('c', '2026-08-14')],
    ])
    const q = buildQueue({ allIds, states, today: '2026-08-14', capacity: 2 })
    expect(q.due).toHaveLength(3)
    expect(q.fresh).toEqual([])
  })

  it('計測期間中（capacityがnull）は新規を出さない', () => {
    const states = new Map([['a', state('a', '2026-08-14')]])
    const q = buildQueue({ allIds, states, today: '2026-08-14', capacity: null })
    expect(q.due).toEqual(['a'])
    expect(q.fresh).toEqual([])
  })

  it('一度も解いていない問題だけが新規になる', () => {
    const states = new Map([['a', state('a', '2026-09-01')]])
    const q = buildQueue({ allIds, states, today: '2026-08-14', capacity: 10 })
    expect(q.due).toEqual([])
    expect(q.fresh).toEqual(['b', 'c', 'd', 'e'])
  })

  it('渡された順序を保つ', () => {
    const q = buildQueue({ allIds: ['e', 'd', 'c'], states: new Map(), today: '2026-08-14', capacity: 2 })
    expect(q.fresh).toEqual(['e', 'd'])
  })
})
