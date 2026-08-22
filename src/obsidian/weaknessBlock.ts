import { Notice } from 'obsidian'
import { parseIntField } from '../core/filter'
import { aggregateWeakness, type WeaknessRow } from '../core/weakness'
import { HISSHU_PASS_RATE, isHisshu, scoreHisshu, type HisshuRanges } from '../core/hisshu'
import { buildStates, latestResults } from '../core/state'
import type { Result, ReviewEntry } from '../core/types'
import { earliestExamDate, loadConfig } from './config'
import { openInPreview } from './openInPreview'
import { indexQuestions, type QuestionMeta } from './questionIndex'
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
      void openInPreview(plugin.app, '国試対策/自分で選んで解く')
      new Notice(`「演習.md」で ${filterKey}: ${row.key} / status: 苦手 に書き換えて絞り込めます`)
    }
    li.createSpan({
      text: `　${bar(row.masteryRate)}　定着 ${row.mastered}/${row.attempted}（${percent}%）｜苦手 ${row.weak}｜未着手 ${row.untouched}`,
    })
  }
}

/**
 * 必修の仕上がりを一番上に出す。
 * 必修は50問中40問（8割）が絶対条件で、ここを落とすと他が満点でも不合格になる。
 * 分野別の定着率に埋もれさせず、単独で見えるようにする。
 */
function renderHisshu(
  parent: HTMLElement,
  questions: QuestionMeta[],
  entries: ReviewEntry[],
  ranges: HisshuRanges,
): void {
  const hisshuIds = new Set(questions.filter((q) => isHisshu(q, ranges)).map((q) => q.id))
  if (hisshuIds.size === 0) return

  const latest = latestResults(entries)
  const results = [...hisshuIds].map((id) => latest.get(id)).filter((r): r is Result => r !== undefined)
  const score = scoreHisshu(results)

  parent.createEl('p', { text: '必修（8割が絶対条件）', cls: 'kokushi-section-title' })
  if (score.rate === null) {
    parent.createEl('p', { text: `　必修 ${hisshuIds.size}問。まだ1問も解いていません` })
    return
  }
  const percent = Math.round(score.rate * 100)
  const mark = score.passing === true ? '✅' : '⚠️'
  parent.createEl('p', {
    text:
      `　${mark} ${bar(score.rate)}　正答 ${score.correct}/${score.attempted}（${percent}%）` +
      `｜必要 ${Math.round(HISSHU_PASS_RATE * 100)}%｜未着手 ${hisshuIds.size - score.attempted}問`,
  })
  // △は正解に数えていない。まぐれ当たりを8割に入れると本番で足をすくわれるため
  parent.createEl('p', { text: '　（△は正解に数えていません）', cls: 'kokushi-feedback' })
}

export function registerWeaknessBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-weakness', async (source, el) => {
    try {
      el.empty()
      const topicLimit = parseIntField(source, 'topics', DEFAULT_TOPIC_LIMIT)

      const config = await loadConfig(plugin.app)
      const examDate = earliestExamDate(config)
      const entries = await plugin.logStore.readAll()
      const states = buildStates(entries)
      const questions = indexQuestions(plugin.app)

      if (questions.length === 0) {
        el.createEl('p', { text: '問題ノートがありません' })
        return
      }

      renderHisshu(el, questions, entries, config.hisshu)

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
    } catch (error) {
      el.empty()
      el.createEl('p', { text: '⚠️ 表示に失敗しました。開発者ツールのコンソールを確認してください' })
      console.error('kokushi-srs: 表示に失敗しました', error)
    }
  })
}
