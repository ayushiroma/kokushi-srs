import { describe, expect, it } from 'vitest'
import { presentExams } from '../src/core/fields'

describe('presentExams', () => {
  it('重複を除いて EXAM_ORDER の順に並べる', () => {
    expect(presentExams(['phn', 'nurse', 'phn', 'nurse'])).toEqual(['nurse', 'phn'])
  })

  it('保健師の問題しか無い場合は保健師だけを返す', () => {
    expect(presentExams(['phn', 'phn'])).toEqual(['phn'])
  })

  it('EXAM_ORDER に無い試験は末尾に、アルファベット順で回す', () => {
    expect(presentExams(['zzz', 'nurse', 'aaa'])).toEqual(['nurse', 'aaa', 'zzz'])
  })

  it('空配列なら空配列を返す', () => {
    expect(presentExams([])).toEqual([])
  })
})
