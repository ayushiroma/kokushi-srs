import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HISSHU,
  HISSHU_PASS_RATE,
  isHisshu,
  scoreHisshu,
  type HisshuRanges,
} from '../src/core/hisshu'

describe('isHisshu', () => {
  it('看護師の午前1〜25と午後1〜25が必修', () => {
    expect(isHisshu({ exam: 'nurse', session: 'am', number: 1 }, DEFAULT_HISSHU)).toBe(true)
    expect(isHisshu({ exam: 'nurse', session: 'am', number: 25 }, DEFAULT_HISSHU)).toBe(true)
    expect(isHisshu({ exam: 'nurse', session: 'pm', number: 25 }, DEFAULT_HISSHU)).toBe(true)
  })

  it('境界の外は必修でない', () => {
    expect(isHisshu({ exam: 'nurse', session: 'am', number: 26 }, DEFAULT_HISSHU)).toBe(false)
    expect(isHisshu({ exam: 'nurse', session: 'am', number: 0 }, DEFAULT_HISSHU)).toBe(false)
  })

  it('保健師には必修の区分が無いので常に false', () => {
    expect(isHisshu({ exam: 'phn', session: 'am', number: 1 }, DEFAULT_HISSHU)).toBe(false)
  })

  it('設定で範囲を変えられる（PDFに明記が無いので直せる必要がある）', () => {
    const custom: HisshuRanges = { nurse: { am: [1, 30], pm: [1, 30] } }
    expect(isHisshu({ exam: 'nurse', session: 'am', number: 30 }, custom)).toBe(true)
    expect(isHisshu({ exam: 'nurse', session: 'am', number: 31 }, custom)).toBe(false)
  })

  it('知らない試験・時間帯でも落ちない', () => {
    expect(isHisshu({ exam: 'unknown', session: 'am', number: 1 }, DEFAULT_HISSHU)).toBe(false)
    expect(isHisshu({ exam: 'nurse', session: 'eve', number: 1 }, DEFAULT_HISSHU)).toBe(false)
  })
})

describe('scoreHisshu', () => {
  it('1問も解いていなければ判定しない', () => {
    expect(scoreHisshu([])).toEqual({ attempted: 0, correct: 0, rate: null, passing: null })
  })

  it('△は正解に数えない（本番で落とす可能性が高いため）', () => {
    const score = scoreHisshu(['ok', 'ok', 'ok', 'vague', 'wrong'])
    expect(score.correct).toBe(3)
    expect(score.rate).toBeCloseTo(0.6)
    expect(score.passing).toBe(false)
  })

  it('ちょうど8割は合格ライン', () => {
    const score = scoreHisshu(['ok', 'ok', 'ok', 'ok', 'wrong'])
    expect(score.rate).toBe(HISSHU_PASS_RATE)
    expect(score.passing).toBe(true)
  })

  it('8割に1問足りなければ不合格', () => {
    const results = [...Array(39).fill('ok'), ...Array(11).fill('wrong')] as ('ok' | 'wrong')[]
    const score = scoreHisshu(results)
    expect(score.correct).toBe(39)
    expect(score.passing).toBe(false)
  })

  it('40/50 で合格（本番の合格ラインそのもの）', () => {
    const results = [...Array(40).fill('ok'), ...Array(10).fill('wrong')] as ('ok' | 'wrong')[]
    expect(scoreHisshu(results).passing).toBe(true)
  })
})
