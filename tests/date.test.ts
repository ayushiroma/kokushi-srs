import { describe, expect, it } from 'vitest'
import { addDays, dateOf, diffDays, toDateString } from '../src/core/date'

describe('toDateString', () => {
  it('ローカル日付をYYYY-MM-DDにする', () => {
    expect(toDateString(new Date(2026, 7, 14, 23, 59))).toBe('2026-08-14')
  })

  it('1桁の月日をゼロ埋めする', () => {
    expect(toDateString(new Date(2027, 0, 5, 0, 0))).toBe('2027-01-05')
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
  it('ISO文字列からローカル日付を取り出す', () => {
    const d = new Date(2026, 7, 14, 21, 3, 11)
    expect(dateOf(d.toISOString())).toBe('2026-08-14')
  })

  it('深夜でも日付がずれない', () => {
    const d = new Date(2026, 7, 14, 0, 30, 0)
    expect(dateOf(d.toISOString())).toBe('2026-08-14')
  })
})
