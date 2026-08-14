import { describe, expect, it } from 'vitest'
import { parseFilter, parseIntField } from '../src/core/filter'

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

  it('全角コロンでも読める', () => {
    const f = parseFilter('field：成人看護学\nlimit：20')
    expect(f.field).toBe('成人看護学')
    expect(f.limit).toBe(20)
  })

  it('半角と全角が混ざっていても読める', () => {
    const f = parseFilter('field: 母性看護学\nstatus：苦手')
    expect(f.field).toBe('母性看護学')
    expect(f.status).toBe('苦手')
  })

  it('空文字列なら既定値だけ', () => {
    expect(parseFilter('')).toEqual({ limit: 50, unknownKeys: [] })
  })

  it('全角数字を半角として読む', () => {
    const f = parseFilter('round：１１５\nlimit：２０')
    expect(f.round).toBe(115)
    expect(f.limit).toBe(20)
  })

  it('認識できないキーを記録する', () => {
    const f = parseFilter('field: 成人看護学\ntags: 睡眠\nunknown: x')
    expect(f.field).toBe('成人看護学')
    expect(f.unknownKeys).toEqual(['tags', 'unknown'])
  })
})

describe('parseIntField', () => {
  it('半角コロンと半角数字を読む', () => {
    expect(parseIntField('topics: 3', 'topics', 5)).toBe(3)
  })

  it('全角コロンと全角数字を読む', () => {
    expect(parseIntField('topics：３', 'topics', 5)).toBe(3)
  })

  it('キーが無ければ既定値', () => {
    expect(parseIntField('other: 3', 'topics', 5)).toBe(5)
  })

  it('0以下なら既定値', () => {
    expect(parseIntField('topics: 0', 'topics', 5)).toBe(5)
  })
})
