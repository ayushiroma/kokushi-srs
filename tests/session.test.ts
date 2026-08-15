import { describe, expect, it } from 'vitest'
import { advance, currentId, isFinished, progress, startSession } from '../src/core/session'

describe('startSession', () => {
  it('先頭の問題からはじまる', () => {
    const s = startSession(['a', 'b', 'c'])
    expect(currentId(s)).toBe('a')
    expect(isFinished(s)).toBe(false)
  })

  it('空配列は最初から終了扱い', () => {
    const s = startSession([])
    expect(currentId(s)).toBeNull()
    expect(isFinished(s)).toBe(true)
  })
})

describe('advance', () => {
  it('次の問題に進む', () => {
    const s = advance(startSession(['a', 'b', 'c']))
    expect(currentId(s)).toBe('b')
    expect(isFinished(s)).toBe(false)
  })

  it('最後の問題からadvanceすると終了する', () => {
    let s = startSession(['a', 'b'])
    s = advance(s)
    s = advance(s)
    expect(isFinished(s)).toBe(true)
    expect(currentId(s)).toBeNull()
  })

  it('終了済みの状態でadvanceしても壊れない（終了のまま）', () => {
    let s = startSession(['a'])
    s = advance(s)
    s = advance(s)
    expect(isFinished(s)).toBe(true)
  })
})

describe('progress', () => {
  it('解いた数と全体数を返す', () => {
    let s = startSession(['a', 'b', 'c'])
    expect(progress(s)).toEqual({ done: 0, total: 3 })
    s = advance(s)
    expect(progress(s)).toEqual({ done: 1, total: 3 })
  })
})
