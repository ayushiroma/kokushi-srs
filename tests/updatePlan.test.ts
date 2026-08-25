import { describe, expect, it } from 'vitest'
import { classifyDataEntry } from '../src/core/updatePlan'

describe('classifyDataEntry', () => {
  it('問題は上書き対象', () => {
    expect(classifyDataEntry('問題/看護師/01_基礎看護学/nurse-115-am-001.md')).toEqual({
      kind: 'overwrite',
      vaultPath: '国試対策/中身/問題/看護師/01_基礎看護学/nurse-115-am-001.md',
    })
  })

  it('_config.jsonは上書き対象', () => {
    expect(classifyDataEntry('_config.json')).toEqual({
      kind: 'overwrite',
      vaultPath: '国試対策/中身/_config.json',
    })
  })

  it('知識ノートはメモ保護つきで扱う', () => {
    expect(classifyDataEntry('知識ノート/糖尿病.md')).toEqual({
      kind: 'knowledge-note',
      vaultPath: '国試対策/中身/知識ノート/糖尿病.md',
    })
  })

  it('フォルダのエントリはスキップ', () => {
    expect(classifyDataEntry('問題/看護師/')).toEqual({ kind: 'skip' })
  })

  it('_記録が万一含まれていてもスキップ（友達の解答ログを守る防御）', () => {
    expect(classifyDataEntry('_記録/review-desktop.md')).toEqual({ kind: 'skip' })
  })

  it('想定外のトップレベルはスキップ', () => {
    expect(classifyDataEntry('README.md')).toEqual({ kind: 'skip' })
  })
})
