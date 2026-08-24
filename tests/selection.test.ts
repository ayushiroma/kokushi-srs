import { describe, expect, it } from 'vitest'
import { EMPTY_SELECTION, buildFilterFromSelection, fieldOptionsFor } from '../src/core/selection'

describe('buildFilterFromSelection', () => {
  it('何も選ばなければ条件なし', () => {
    const filter = buildFilterFromSelection(EMPTY_SELECTION)
    expect(filter.exam).toBeUndefined()
    expect(filter.field).toBeUndefined()
    expect(filter.type).toBeUndefined()
    expect(filter.status).toBeUndefined()
    expect(filter.round).toBeUndefined()
    expect(filter.unknownKeys).toEqual([])
  })

  it('選んだ項目だけが条件になる', () => {
    const filter = buildFilterFromSelection({
      exam: 'nurse',
      field: '循環器',
      type: '必修',
      status: '未解答',
      round: '115',
    })
    expect(filter.exam).toBe('nurse')
    expect(filter.field).toBe('循環器')
    expect(filter.type).toBe('必修')
    expect(filter.status).toBe('未解答')
    expect(filter.round).toBe(115)
  })

  it('年度が数値でなければ条件にしない', () => {
    const filter = buildFilterFromSelection({ ...EMPTY_SELECTION, round: 'あ' })
    expect(filter.round).toBeUndefined()
  })

  it('limit の既定は500', () => {
    expect(buildFilterFromSelection(EMPTY_SELECTION).limit).toBe(500)
  })

  it('limit を指定できる', () => {
    expect(buildFilterFromSelection(EMPTY_SELECTION, 20).limit).toBe(20)
  })
})

describe('fieldOptionsFor', () => {
  it('看護師なら26分野', () => {
    expect(fieldOptionsFor('nurse')).toHaveLength(26)
    expect(fieldOptionsFor('nurse')).toContain('循環器')
  })

  it('保健師なら11分野', () => {
    expect(fieldOptionsFor('phn')).toHaveLength(11)
    expect(fieldOptionsFor('phn')).toContain('疫学')
  })

  it('試験を選んでいなければ両方の分野を重複なしで返す', () => {
    const all = fieldOptionsFor('')
    expect(all).toHaveLength(37)
    expect(new Set(all).size).toBe(37)
  })
})
