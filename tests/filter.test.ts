import { describe, expect, it } from 'vitest'
import { parseFilter } from '../src/core/filter'

describe('parseFilter', () => {
  it('キーと値を読む', () => {
    const f = parseFilter('field: 成人看護学\nstatus: 未解答\nlimit: 20')
    expect(f.field).toBe('成人看護学')
    expect(f.status).toBe('未解答')
    expect(f.limit).toBe(20)
  })

  it('limitの既定値は50', () => {
    expect(parseFilter('field: 成人看護学').limit).toBe(50)
  })

  it('roundを数値にする', () => {
    expect(parseFilter('round: 115').round).toBe(115)
  })

  it('数値でないroundを無視する', () => {
    expect(parseFilter('round: あ').round).toBeUndefined()
  })

  it('limitが0以下なら既定値のまま', () => {
    expect(parseFilter('limit: 0').limit).toBe(50)
  })

  it('知らないキーと空行を無視する', () => {
    const f = parseFilter('\nunknown: x\nfield: 母性看護学\n')
    expect(f.field).toBe('母性看護学')
  })

  it('値が空のキーを無視する', () => {
    expect(parseFilter('field:').field).toBeUndefined()
  })

  it('空文字列なら既定値だけ', () => {
    expect(parseFilter('')).toEqual({ limit: 50 })
  })
})
