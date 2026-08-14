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
