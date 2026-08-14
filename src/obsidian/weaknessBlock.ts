import { Notice } from 'obsidian'
import { aggregateWeakness, type WeaknessRow } from '../core/weakness'
import { buildStates } from '../core/state'
import { earliestExamDate, loadConfig } from './config'
import { indexQuestions } from './questionIndex'
import type KokushiPlugin from '../main'

const DEFAULT_TOPIC_LIMIT = 5

function bar(rate: number): string {
  const filled = Math.round(rate * 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

function renderRows(
  parent: HTMLElement,
  rows: WeaknessRow[],
  plugin: KokushiPlugin,
  filterKey: 'field' | 'tag',
): void {
  if (rows.length === 0) {
    parent.createEl('p', { text: '　まだデータがありません' })
    return
  }
  const ul = parent.createEl('ul')
  for (const row of rows) {
    const li = ul.createEl('li')
    const percent = Math.round(row.masteryRate * 100)
    const link = li.createEl('a', { text: row.key, href: '#' })
    link.onclick = (ev) => {
      ev.preventDefault()
      void plugin.app.workspace.openLinkText('国試対策/演習', '', false)
      new Notice(`「演習.md」で ${filterKey}: ${row.key} / status: 苦手 に書き換えて絞り込めます`)
    }
    li.createSpan({
      text: `　${bar(row.masteryRate)}　定着 ${row.mastered}/${row.attempted}（${percent}%）｜苦手 ${row.weak}｜未着手 ${row.untouched}`,
    })
  }
}

export function registerWeaknessBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-weakness', async (source, el) => {
    el.empty()
    const match = /(?:^|\n)\s*topics:\s*(\d+)/.exec(source)
    const topicLimit = match ? Number(match[1]) : DEFAULT_TOPIC_LIMIT

    const examDate = earliestExamDate(await loadConfig(plugin.app))
    const states = buildStates(await plugin.logStore.readAll())
    const questions = indexQuestions(plugin.app)

    if (questions.length === 0) {
      el.createEl('p', { text: '問題ノートがありません' })
      return
    }

    el.createEl('p', { text: '分野別（全体像）', cls: 'kokushi-section-title' })
    renderRows(
      el,
      aggregateWeakness(questions.map((q) => ({ key: q.field, id: q.id })), states, examDate),
      plugin,
      'field',
    )

    el.createEl('p', {
      text: `10分で潰すならここ（トピック別ワースト${topicLimit}）`,
      cls: 'kokushi-section-title',
    })
    const topicRows = aggregateWeakness(
      questions.flatMap((q) => q.tags.map((tag) => ({ key: tag, id: q.id }))),
      states,
      examDate,
    ).filter((row) => row.weak > 0)
    renderRows(el, topicRows.slice(0, topicLimit), plugin, 'tag')
  })
}
