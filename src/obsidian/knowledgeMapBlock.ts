import { buildKnowledgeMap, countUniqueNotes } from '../core/knowledgeMap'
import { openInPreview } from './openInPreview'
import { indexQuestions } from './questionIndex'
import { RENDER_ERROR } from './messages'
import type KokushiPlugin from '../main'

const KNOWLEDGE_DIR = '国試対策/知識ノート'

/**
 * 知識ノートの中から伸びているのに、本体がまだ無いリンクを集める。
 * 「次に何を書けばいいか」がそのまま出る。
 */
function collectUnwritten(plugin: KokushiPlugin): string[] {
  const unresolved = plugin.app.metadataCache.unresolvedLinks
  const names = new Set<string>()
  for (const [source, links] of Object.entries(unresolved)) {
    if (!source.startsWith(`${KNOWLEDGE_DIR}/`)) continue
    for (const name of Object.keys(links)) names.add(name)
  }
  return [...names].sort(new Intl.Collator('ja').compare)
}

function appendLinks(parent: HTMLElement, names: string[], plugin: KokushiPlugin): void {
  names.forEach((name, i) => {
    if (i > 0) parent.createSpan({ text: '・' })
    const link = parent.createEl('a', { text: name, href: '#' })
    link.onclick = (ev) => {
      ev.preventDefault()
      void openInPreview(plugin.app, name)
    }
  })
}

export function registerKnowledgeMapBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-map', (_source, el) => {
    try {
      el.empty()
      const questions = indexQuestions(plugin.app)
      const map = buildKnowledgeMap(questions)

      if (map.length === 0) {
        el.createEl('p', { text: 'まだ知識ノートに繋がっている問題がありません' })
        return
      }

      const unwritten = collectUnwritten(plugin)
      el.createEl('p', {
        text: `知識ノート ${countUniqueNotes(map)} 件 ／ まだ書いていない概念 ${unwritten.length} 件`,
        cls: 'kokushi-section-title',
      })

      for (const exam of map) {
        el.createEl('p', { text: exam.label, cls: 'kokushi-section-title' })
        for (const group of exam.groups) {
          const row = el.createEl('div', { cls: 'kokushi-map-row' })
          row.createEl('strong', { text: group.field })
          row.createSpan({ text: '　' })
          appendLinks(row, group.notes, plugin)
        }
      }

      if (unwritten.length > 0) {
        el.createEl('p', { text: 'まだ書いていない概念', cls: 'kokushi-section-title' })
        const row = el.createEl('div', { cls: 'kokushi-map-row' })
        appendLinks(row, unwritten, plugin)
      }
    } catch (error) {
      el.empty()
      el.createEl('p', { text: RENDER_ERROR })
      console.error('kokushi-srs: 知識マップの表示に失敗しました', error)
    }
  })
}
