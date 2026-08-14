import { describe, expect, it } from 'vitest'
import { addDays, dateOf, diffDays, toDateString } from '../src/core/date'

describe('toDateString', () => {
  it('日本時間の日付をYYYY-MM-DDで返す', () => {
    expect(toDateString(new Date('2026-08-14T23:59:00+09:00'))).toBe('2026-08-14')
  })

  it('1桁の月日をゼロ埋めする', () => {
    expect(toDateString(new Date('2027-01-05T00:00:00+09:00'))).toBe('2027-01-05')
  })

  it('実行環境のタイムゾーン設定に影響されない', () => {
    // 14:59Z は 23:59 JST（同じ日）
    expect(toDateString(new Date('2026-08-14T14:59:00Z'))).toBe('2026-08-14')
    // 15:01Z は翌日 00:01 JST
    expect(toDateString(new Date('2026-08-14T15:01:00Z'))).toBe('2026-08-15')
  })

  it('日本時間の日付境界をまたぐ', () => {
    expect(toDateString(new Date('2026-08-14T23:59:59+09:00'))).toBe('2026-08-14')
    expect(toDateString(new Date('2026-08-15T00:00:00+09:00'))).toBe('2026-08-15')
  })
})

describe('addDays', () => {
  it('日数を足す', () => {
    expect(addDays('2026-08-14', 3)).toBe('2026-08-17')
  })

  it('月をまたぐ', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
  })

  it('年をまたぐ', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04')
  })

  it('うるう年の2月を正しく扱う', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('負の日数を足すと過去に戻る', () => {
    expect(addDays('2026-08-14', -14)).toBe('2026-07-31')
  })
})

describe('diffDays', () => {
  it('日数の差を返す', () => {
    expect(diffDays('2026-08-14', '2027-02-12')).toBe(182)
  })

  it('同じ日なら0', () => {
    expect(diffDays('2026-08-14', '2026-08-14')).toBe(0)
  })

  it('過去向きなら負の値', () => {
    expect(diffDays('2026-08-14', '2026-08-11')).toBe(-3)
  })
})

describe('dateOf', () => {
  it('ISO文字列から日本時間の日付を取り出す', () => {
    expect(dateOf('2026-08-14T21:03:11+09:00')).toBe('2026-08-14')
  })

  it('深夜でも日本時間で判定する', () => {
    expect(dateOf('2026-08-14T00:30:00+09:00')).toBe('2026-08-14')
  })

  it('UTC表記で渡されても日本時間に換算する', () => {
    // 2026-08-13T16:00Z = 2026-08-14T01:00 JST
    expect(dateOf('2026-08-13T16:00:00Z')).toBe('2026-08-14')
  })
})
