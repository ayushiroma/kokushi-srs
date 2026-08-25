import { describe, expect, it } from 'vitest'
import { isKokushiNote } from '../src/core/vaultPaths'

describe('isKokushiNote', () => {
  it('国試対策の中のノートを見分ける', () => {
    expect(isKokushiNote('国試対策/ホーム.md')).toBe(true)
    expect(isKokushiNote('国試対策/メニュー/使い方.md')).toBe(true)
    expect(isKokushiNote('国試対策/データ/問題/看護師/01_基礎看護学/nurse-115-am-001.md')).toBe(true)
    expect(isKokushiNote('国試対策/データ/知識ノート/糖尿病.md')).toBe(true)
  })

  it('国試対策の外は対象にしない（押して新規作成できる標準の動きを奪わないため）', () => {
    expect(isKokushiNote('daily note/2026-08-23.md')).toBe(false)
    expect(isKokushiNote('Memo/思いつき.md')).toBe(false)
    expect(isKokushiNote('Claude/Worklog/2026-08-23.md')).toBe(false)
    expect(isKokushiNote('腓骨神経麻痺.md')).toBe(false)
  })

  it('名前が前方一致するだけの別フォルダを巻き込まない', () => {
    expect(isKokushiNote('国試対策メモ/雑記.md')).toBe(false)
    expect(isKokushiNote('国試対策2/ホーム.md')).toBe(false)
  })

  it('国試対策.md という名前のノート自体は対象にする', () => {
    expect(isKokushiNote('国試対策.md')).toBe(true)
  })

  it('空文字は対象外', () => {
    expect(isKokushiNote('')).toBe(false)
  })
})
