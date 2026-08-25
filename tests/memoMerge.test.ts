import { describe, expect, it } from 'vitest'
import { mergeKnowledgeNote } from '../src/core/memoMerge'

describe('mergeKnowledgeNote', () => {
  it('既存ファイルが無いときは新データをそのまま使う', () => {
    expect(mergeKnowledgeNote('# 糖尿病\n\n## メモ\n', null)).toBe('# 糖尿病\n\n## メモ\n')
  })

  it('既存に##メモが無いときは新データで丸ごと置き換える', () => {
    const existing = '# 糖尿病\n\n古い本文\n'
    const updated = mergeKnowledgeNote('# 糖尿病\n\n新しい本文\n', existing)
    expect(updated).toBe('# 糖尿病\n\n新しい本文\n')
  })

  it('既存に##メモがあれば新本文＋既存メモを結合する', () => {
    const existing = '# 糖尿病\n\n古い本文\n\n## メモ\n友達が書いたメモ\n'
    const updated = mergeKnowledgeNote('# 糖尿病\n\n新しい本文\n', existing)
    expect(updated).toBe('# 糖尿病\n\n新しい本文\n\n## メモ\n友達が書いたメモ\n')
  })

  it('新データ側に##メモが無くても既存メモは保持する', () => {
    const existing = '# 糖尿病\n\n古い本文\n\n## メモ\n友達が書いたメモ\n'
    const updated = mergeKnowledgeNote('# 糖尿病\n\n新しい本文だけ\n', existing)
    expect(updated).toBe('# 糖尿病\n\n新しい本文だけ\n\n## メモ\n友達が書いたメモ\n')
  })

  it('##メモは常に最後のセクションとみなし、それ以降の内容も丸ごとメモとして保持する', () => {
    const existing = '# 糖尿病\n\n古い本文\n\n## メモ\n友達が書いたメモ\n\n## 更に別の見出し\n続きの文章\n'
    const updated = mergeKnowledgeNote('# 糖尿病\n\n新しい本文\n', existing)
    expect(updated).toBe(
      '# 糖尿病\n\n新しい本文\n\n## メモ\n友達が書いたメモ\n\n## 更に別の見出し\n続きの文章\n'
    )
  })
})
