import { describe, expect, it } from 'vitest'
import { isExamModeSelection, scoreExam } from '../src/core/examScore'
import type { HisshuRanges } from '../src/core/hisshu'

const NURSE_RANGES: HisshuRanges = { nurse: { am: [1, 25], pm: [1, 25] } }

describe('isExamModeSelection', () => {
  it('試験と年度だけ選んでいれば本番モード', () => {
    expect(
      isExamModeSelection({ exam: 'nurse', field: '', type: '', status: '', round: '115' })
    ).toBe(true)
  })

  it('分野も選んでいれば本番モードにしない', () => {
    expect(
      isExamModeSelection({
        exam: 'nurse',
        field: '循環器',
        type: '',
        status: '',
        round: '115',
      })
    ).toBe(false)
  })

  it('種別も選んでいれば本番モードにしない', () => {
    expect(
      isExamModeSelection({ exam: 'nurse', field: '', type: '必修', status: '', round: '115' })
    ).toBe(false)
  })

  it('状態も選んでいれば本番モードにしない', () => {
    expect(
      isExamModeSelection({ exam: 'nurse', field: '', type: '', status: '苦手', round: '115' })
    ).toBe(false)
  })

  it('試験が未選択なら本番モードにしない', () => {
    expect(
      isExamModeSelection({ exam: '', field: '', type: '', status: '', round: '115' })
    ).toBe(false)
  })

  it('年度が未選択なら本番モードにしない', () => {
    expect(
      isExamModeSelection({ exam: 'nurse', field: '', type: '', status: '', round: '' })
    ).toBe(false)
  })
})

describe('scoreExam', () => {
  it('必修と一般を振り分けて集計する（△は正解に数えない）', () => {
    const questions = [
      { id: 'q1', exam: 'nurse', session: 'am', number: 1 }, // 必修
      { id: 'q2', exam: 'nurse', session: 'am', number: 2 }, // 必修
      { id: 'q3', exam: 'nurse', session: 'am', number: 26 }, // 一般
      { id: 'q4', exam: 'nurse', session: 'am', number: 27 }, // 一般
    ]
    const answers = [
      { id: 'q1', result: 'ok' as const },
      { id: 'q2', result: 'vague' as const }, // 必修だが正解に数えない
      { id: 'q3', result: 'ok' as const },
      { id: 'q4', result: 'wrong' as const },
    ]
    const score = scoreExam(answers, questions, NURSE_RANGES)
    expect(score.hisshu).toEqual({ attempted: 2, correct: 1, rate: 0.5, passing: false })
    expect(score.general).toEqual({ attempted: 2, correct: 1, rate: 0.5 })
    expect(score.total).toEqual({ attempted: 4, correct: 2, rate: 0.5 })
  })

  it('必修8割に到達していれば passing が true', () => {
    const questions = Array.from({ length: 5 }, (_, i) => ({
      id: `q${i}`,
      exam: 'nurse',
      session: 'am',
      number: i + 1,
    }))
    const answers: { id: string; result: 'ok' | 'wrong' }[] = questions.map((q, i) => ({
      id: q.id,
      result: i < 4 ? 'ok' : 'wrong',
    }))
    const score = scoreExam(answers, questions, NURSE_RANGES)
    expect(score.hisshu?.passing).toBe(true)
  })

  it('必修の区分が無い試験（保健師）では hisshu が null で全問が total に入る', () => {
    const questions = [
      { id: 'q1', exam: 'phn', session: 'am', number: 1 },
      { id: 'q2', exam: 'phn', session: 'am', number: 2 },
    ]
    const answers = [
      { id: 'q1', result: 'ok' as const },
      { id: 'q2', result: 'wrong' as const },
    ]
    const score = scoreExam(answers, questions, NURSE_RANGES)
    expect(score.hisshu).toBeNull()
    expect(score.general).toEqual({ attempted: 2, correct: 1, rate: 0.5 })
    expect(score.total).toEqual({ attempted: 2, correct: 1, rate: 0.5 })
  })

  it('回答が1件も無ければ rate は null（ゼロ除算しない）', () => {
    const score = scoreExam([], [], NURSE_RANGES)
    expect(score.hisshu).toBeNull()
    expect(score.general).toEqual({ attempted: 0, correct: 0, rate: null })
    expect(score.total).toEqual({ attempted: 0, correct: 0, rate: null })
  })

  it('回答に対応する問題が見つからない場合は無視する', () => {
    const questions = [{ id: 'q1', exam: 'nurse', session: 'am', number: 1 }]
    const answers = [
      { id: 'q1', result: 'ok' as const },
      { id: 'ghost', result: 'ok' as const },
    ]
    const score = scoreExam(answers, questions, NURSE_RANGES)
    expect(score.total.attempted).toBe(1)
  })
})
