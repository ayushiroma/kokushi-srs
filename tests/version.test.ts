import { describe, expect, it } from 'vitest'
import { bumpVersion, isNewerVersion } from '../src/core/version'

describe('isNewerVersion', () => {
  it('パッチ・マイナー・メジャーそれぞれ新しいと判定する', () => {
    expect(isNewerVersion('1.2.3', '1.2.4')).toBe(true)
    expect(isNewerVersion('1.2.3', '1.3.0')).toBe(true)
    expect(isNewerVersion('1.2.3', '2.0.0')).toBe(true)
  })

  it('同じバージョンや古いバージョンはfalse', () => {
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false)
    expect(isNewerVersion('1.2.3', '1.2.2')).toBe(false)
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(false)
  })

  it('先頭のvは無視する', () => {
    expect(isNewerVersion('1.2.3', 'v1.2.4')).toBe(true)
    expect(isNewerVersion('v1.2.3', 'v1.2.3')).toBe(false)
  })

  it('壊れた文字列はfalse扱い（更新に見せない）', () => {
    expect(isNewerVersion('1.2.3', 'not-a-version')).toBe(false)
    expect(isNewerVersion('not-a-version', '1.2.3')).toBe(false)
    expect(isNewerVersion('1.2.3', '')).toBe(false)
  })
})

describe('bumpVersion', () => {
  it('patch/minor/majorそれぞれ正しく上げる', () => {
    expect(bumpVersion('0.1.0', 'patch')).toBe('0.1.1')
    expect(bumpVersion('0.1.9', 'minor')).toBe('0.2.0')
    expect(bumpVersion('1.9.9', 'major')).toBe('2.0.0')
  })

  it('不正な文字列は例外を投げる', () => {
    expect(() => bumpVersion('bad', 'patch')).toThrow()
  })
})
