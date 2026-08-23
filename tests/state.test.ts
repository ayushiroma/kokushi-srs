import { describe, expect, it } from 'vitest'
import { buildStates } from '../src/core/state'
import type { ReviewEntry } from '../src/core/types'

const entries: ReviewEntry[] = [
  { id: 'a', at: '2026-08-14T10:00:00+09:00', result: 'ok' },
  { id: 'b', at: '2026-08-14T10:01:00+09:00', result: 'wrong' },
  { id: 'a', at: '2026-08-15T10:00:00+09:00', result: 'ok' },
]

describe('buildStates', () => {
  it('問題ごとに最新の状態を持つ', () => {
    const states = buildStates(entries)
    expect(states.size).toBe(2)
    expect(states.get('a')!.streak).toBe(2)
    expect(states.get('a')!.nextDue).toBe('2026-08-18')
    expect(states.get('b')!.streak).toBe(0)
  })

  it('一度も出てこない問題は含まれない', () => {
    expect(buildStates(entries).has('z')).toBe(false)
  })

  it('空のログなら空のMap', () => {
    expect(buildStates([]).size).toBe(0)
  })

  it('同じ問題を何度解いても回数が積み上がる', () => {
    const states = buildStates(entries)
    expect(states.get('a')!.reviews).toBe(2)
  })
})

describe('buildStates：同じ日の押し直し', () => {
  it('同じ日に⭕を2回記録しても、復習は1回分しか進まない', () => {
    const once = buildStates([{ id: 'a', at: '2026-08-14T10:00:00+09:00', result: 'ok' }])
    const twice = buildStates([
      { id: 'a', at: '2026-08-14T10:00:00+09:00', result: 'ok' },
      // 自動採点のあとに、光っている⭕を確認のつもりで押した場合
      { id: 'a', at: '2026-08-14T10:00:30+09:00', result: 'ok' },
    ])
    expect(twice.get('a')!.streak).toBe(once.get('a')!.streak)
    expect(twice.get('a')!.nextDue).toBe(once.get('a')!.nextDue)
    expect(twice.get('a')!.reviews).toBe(1)
  })

  it('同じ日なら最後の記録が正になる（❌のあとに⭕へ直した場合）', () => {
    const states = buildStates([
      { id: 'a', at: '2026-08-14T10:00:00+09:00', result: 'wrong' },
      { id: 'a', at: '2026-08-14T10:00:30+09:00', result: 'ok' },
    ])
    expect(states.get('a')!.streak).toBe(1)
  })

  it('❌のあとにメモを足して2件になっても、復習は1回分しか進まない', () => {
    const states = buildStates([
      { id: 'a', at: '2026-08-14T10:00:00+09:00', result: 'wrong' },
      { id: 'a', at: '2026-08-14T10:01:00+09:00', result: 'wrong', reason: '法律名を取り違えた' },
    ])
    expect(states.get('a')!.reviews).toBe(1)
    expect(states.get('a')!.streak).toBe(0)
  })

  it('日をまたげば別の復習として数える', () => {
    const states = buildStates([
      { id: 'a', at: '2026-08-14T10:00:00+09:00', result: 'ok' },
      { id: 'a', at: '2026-08-14T10:00:30+09:00', result: 'ok' },
      { id: 'a', at: '2026-08-15T10:00:00+09:00', result: 'ok' },
    ])
    expect(states.get('a')!.reviews).toBe(2)
    expect(states.get('a')!.streak).toBe(2)
  })

  it('別の問題どうしは影響し合わない', () => {
    const states = buildStates([
      { id: 'a', at: '2026-08-14T10:00:00+09:00', result: 'ok' },
      { id: 'b', at: '2026-08-14T10:01:00+09:00', result: 'ok' },
      { id: 'a', at: '2026-08-14T10:02:00+09:00', result: 'wrong' },
    ])
    expect(states.get('a')!.streak).toBe(0)
    expect(states.get('b')!.streak).toBe(1)
  })
})
