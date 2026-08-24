import { describe, expect, it } from 'vitest'
import { judge, parseChoiceNumbers } from '../src/core/choices'

describe('parseChoiceNumbers', () => {
  it('4択の選択肢を取り出す', () => {
    const body = [
      '法律とその内容の組合せで正しいのはどれか。',
      '',
      '1. 児童福祉法',
      '2. 母子保健法',
      '3. アルコール健康障害対策基本法',
      '4. 障害者虐待防止法',
    ].join('\n')
    expect(parseChoiceNumbers(body)).toEqual([1, 2, 3, 4])
  })

  it('5択も取り出す', () => {
    const body = ['1. あ', '2. い', '3. う', '4. え', '5. お'].join('\n')
    expect(parseChoiceNumbers(body)).toEqual([1, 2, 3, 4, 5])
  })

  it('全角ピリオドでも取り出す', () => {
    const body = ['1． あ', '2． い', '3． う', '4． え'].join('\n')
    expect(parseChoiceNumbers(body)).toEqual([1, 2, 3, 4])
  })

  it('解説の中の番号付き行は拾わない', () => {
    const body = [
      '1. あ',
      '2. い',
      '3. う',
      '4. え',
      '',
      '> [!解説]-',
      '> **正答：4**',
      '> - 1. これは解説の中の行',
      '> - 2. これも解説の中の行',
    ].join('\n')
    expect(parseChoiceNumbers(body)).toEqual([1, 2, 3, 4])
  })

  it('番号が飛んでいたら空を返す', () => {
    const body = ['1. あ', '3. う', '4. え', '5. お'].join('\n')
    expect(parseChoiceNumbers(body)).toEqual([])
  })

  it('選択肢が3つ以下なら空を返す', () => {
    const body = ['1. あ', '2. い', '3. う'].join('\n')
    expect(parseChoiceNumbers(body)).toEqual([])
  })

  it('選択肢がなければ空を返す', () => {
    expect(parseChoiceNumbers('ただの文章です。')).toEqual([])
  })
})

describe('judge', () => {
  it('単一正答で一致すれば ok', () => {
    expect(judge([4], [4])).toBe('ok')
  })

  it('単一正答で外れれば wrong', () => {
    expect(judge([3], [4])).toBe('wrong')
  })

  it('複数正答で完全一致すれば ok', () => {
    expect(judge([4, 5], [4, 5])).toBe('ok')
  })

  it('複数正答は順番が違っても ok', () => {
    expect(judge([5, 4], [4, 5])).toBe('ok')
  })

  it('複数正答で片方だけ合っていても wrong', () => {
    expect(judge([4, 3], [4, 5])).toBe('wrong')
  })

  it('選んだ数が足りなければ wrong', () => {
    expect(judge([4], [4, 5])).toBe('wrong')
  })

  it('何も選んでいなければ wrong', () => {
    expect(judge([], [4])).toBe('wrong')
  })
})
