import { describe, expect, it } from 'vitest'
import {
  buildKnowledgeMap,
  countUniqueNotes,
  filterToExisting,
  parseWikiLink,
  type KnowledgeSource,
} from '../src/core/knowledgeMap'

describe('parseWikiLink', () => {
  it('[[ ]] を外す', () => {
    expect(parseWikiLink('[[レム睡眠]]')).toBe('レム睡眠')
  })

  it('別名を落とす', () => {
    expect(parseWikiLink('[[心不全|心臓のポンプ失調]]')).toBe('心不全')
  })

  it('見出しを落とす', () => {
    expect(parseWikiLink('[[心不全#前負荷]]')).toBe('心不全')
  })

  it('前後の空白を無視する', () => {
    expect(parseWikiLink('  [[ 破傷風 ]]  ')).toBe('破傷風')
  })

  it('リンク記法でない素の文字列も受け付ける', () => {
    expect(parseWikiLink('PHEIC')).toBe('PHEIC')
  })

  it('空文字と中身の無いリンクは null', () => {
    expect(parseWikiLink('')).toBeNull()
    expect(parseWikiLink('   ')).toBeNull()
    expect(parseWikiLink('[[]]')).toBeNull()
    expect(parseWikiLink('[[|別名だけ]]')).toBeNull()
  })
})

describe('buildKnowledgeMap', () => {
  const sources: KnowledgeSource[] = [
    { exam: 'nurse', field: '感染症', knowledge: ['[[破傷風]]'] },
    { exam: 'nurse', field: '基礎医学', knowledge: ['[[レム睡眠]]'] },
    { exam: 'phn', field: '健康危機管理', knowledge: ['[[PHEIC]]'] },
  ]

  it('試験ごとに分ける（看護師が先、保健師が後）', () => {
    const map = buildKnowledgeMap(sources)
    expect(map.map((e) => e.exam)).toEqual(['nurse', 'phn'])
    expect(map.map((e) => e.label)).toEqual(['看護師', '保健師'])
  })

  it('分野はQBの章立ての順に並ぶ（出現順でも五十音順でもない）', () => {
    const map = buildKnowledgeMap(sources)
    // 入力は 感染症 → 基礎医学 の順だが、QBでは 基礎医学 のほうが先
    expect(map[0].groups.map((g) => g.field)).toEqual(['基礎医学', '感染症'])
  })

  it('同じ知識ノートが複数の分野から参照されていれば、その全部に出る', () => {
    const map = buildKnowledgeMap([
      { exam: 'nurse', field: '循環器', knowledge: ['[[心不全]]'] },
      { exam: 'nurse', field: '老年看護学', knowledge: ['[[心不全]]'] },
    ])
    expect(map[0].groups).toEqual([
      { field: '循環器', notes: ['心不全'] },
      { field: '老年看護学', notes: ['心不全'] },
    ])
  })

  it('同じ分野に同じノートが重複しても1件にまとまる', () => {
    const map = buildKnowledgeMap([
      { exam: 'nurse', field: '感染症', knowledge: ['[[破傷風]]'] },
      { exam: 'nurse', field: '感染症', knowledge: ['[[破傷風]]', '[[結核]]'] },
    ])
    expect(map[0].groups[0].notes).toEqual(['結核', '破傷風'])
  })

  it('定義に無い分野も落とさず末尾に回す', () => {
    const map = buildKnowledgeMap([
      { exam: 'nurse', field: 'まだ無い分野', knowledge: ['[[謎]]'] },
      { exam: 'nurse', field: '基礎医学', knowledge: ['[[レム睡眠]]'] },
    ])
    expect(map[0].groups.map((g) => g.field)).toEqual(['基礎医学', 'まだ無い分野'])
  })

  it('分野が空の問題は無視する', () => {
    expect(buildKnowledgeMap([{ exam: 'nurse', field: '', knowledge: ['[[謎]]'] }])).toEqual([])
  })

  it('知識ノートを持たない問題は分野ごと出さない', () => {
    expect(buildKnowledgeMap([{ exam: 'nurse', field: '感染症', knowledge: [] }])).toEqual([])
  })

  it('定義に無い試験も落とさず末尾に回す', () => {
    const map = buildKnowledgeMap([
      { exam: 'unknown', field: '何か', knowledge: ['[[謎]]'] },
      ...sources,
    ])
    expect(map.map((e) => e.exam)).toEqual(['nurse', 'phn', 'unknown'])
    // ラベルが引けない試験はIDをそのまま出す
    expect(map[2].label).toBe('unknown')
  })

  it('入力が空なら空', () => {
    expect(buildKnowledgeMap([])).toEqual([])
  })
})

describe('countUniqueNotes', () => {
  it('複数分野にまたがるノートを二重に数えない', () => {
    const map = buildKnowledgeMap([
      { exam: 'nurse', field: '循環器', knowledge: ['[[心不全]]'] },
      { exam: 'nurse', field: '老年看護学', knowledge: ['[[心不全]]'] },
      { exam: 'phn', field: '疫学', knowledge: ['[[心不全]]', '[[有病率]]'] },
    ])
    expect(countUniqueNotes(map)).toBe(2)
  })

  it('空なら0', () => {
    expect(countUniqueNotes([])).toBe(0)
  })
})

describe('filterToExisting', () => {
  const map = buildKnowledgeMap([
    { exam: 'nurse', field: '循環器', knowledge: ['[[心不全]]', '[[未作成A]]'] },
    { exam: 'nurse', field: '呼吸器', knowledge: ['[[未作成B]]'] },
    { exam: 'phn', field: '疫学', knowledge: ['[[有病率]]'] },
  ])
  const exists = (name: string): boolean => ['心不全', '有病率'].includes(name)

  it('本体が無いノートを落とす', () => {
    const kept = filterToExisting(map, exists)
    const nurse = kept.find((e) => e.exam === 'nurse')!
    expect(nurse.groups.find((g) => g.field === '循環器')!.notes).toEqual(['心不全'])
  })

  it('中身が空になった分野は落とす', () => {
    const kept = filterToExisting(map, exists)
    const nurse = kept.find((e) => e.exam === 'nurse')!
    expect(nurse.groups.map((g) => g.field)).toEqual(['循環器'])
  })

  it('中身が空になった試験ごと落とす', () => {
    const kept = filterToExisting(map, (name) => name === '有病率')
    expect(kept.map((e) => e.exam)).toEqual(['phn'])
  })

  it('全部残る場合は元と同じ内容', () => {
    expect(filterToExisting(map, () => true)).toEqual(map)
  })

  it('全部落ちたら空', () => {
    expect(filterToExisting(map, () => false)).toEqual([])
  })

  it('件数は本体があるものだけで数える', () => {
    expect(countUniqueNotes(map)).toBe(4)
    expect(countUniqueNotes(filterToExisting(map, exists))).toBe(2)
  })
})
