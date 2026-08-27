import { Notice } from 'obsidian'
import { parseIntField } from '../core/filter'
import { examLabel, presentExams } from '../core/fields'
import { aggregateWeakness, type WeaknessRow } from '../core/weakness'
import { HISSHU_PASS_RATE, isHisshu, scoreHisshu, type HisshuRanges } from '../core/hisshu'
import { buildStates, latestResults } from '../core/state'
import type { Result, ReviewEntry } from '../core/types'
import { earliestExamDate, loadConfig } from './config'
import { openInPreview } from './openInPreview'
import { indexQuestions, type QuestionMeta } from './questionIndex'
import { RENDER_ERROR } from './messages'
import type KokushiPlugin from '../main'

const DEFAULT_TOPIC_LIMIT = 5

/**
 * 進捗バーを描く。
 *
 * 以前は `█` と `░` を並べた文字のバーだったが、環境によっては絵文字系フォントに
 * フォールバックして虹色のブロックとして描画され、数字が読めなくなる
 * （2026-08-22の実機確認で判明）。ホーム画面と同じCSSのバーに揃える。
 */
function renderBar(parent: HTMLElement, rate: number): void {
  const bar = parent.createDiv({ cls: 'kokushi-bar kokushi-bar-slim' })
  const fill = bar.createDiv({ cls: 'kokushi-bar-fill' })
  fill.style.width = `${Math.min(100, Math.max(0, Math.round(rate * 100)))}%`
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

  // 表にする。分野名の長さがばらばらなので、箇条書きだと数字の開始位置が
  // 行ごとにずれて、分野同士を見比べられない（2026-08-22の実機確認で判明）。
  const wrap = parent.createDiv({ cls: 'kokushi-table-wrap' })
  const table = wrap.createEl('table', { cls: 'kokushi-table' })

  const head = table.createEl('thead').createEl('tr')
  for (const label of [filterKey === 'field' ? '分野' : 'トピック', '仕上がり', '定着', '苦手', '未着手']) {
    head.createEl('th', { text: label })
  }

  const body = table.createEl('tbody')
  for (const row of rows) {
    const tr = body.createEl('tr')
    const percent = Math.round(row.masteryRate * 100)

    const nameCell = tr.createEl('td')
    const link = nameCell.createEl('a', { text: row.key, href: '#' })
    link.onclick = (ev) => {
      ev.preventDefault()
      void openInPreview(plugin.app, '国試対策/メニュー/絞り込んで解く')
      new Notice(`「絞り込んで解く」で ${filterKey === 'field' ? '分野' : 'トピック'}「${row.key}」を選んで絞り込めます`)
    }

    const barCell = tr.createEl('td', { cls: 'kokushi-cell-bar' })
    renderBar(barCell, row.masteryRate)
    barCell.createSpan({ text: `${percent}%`, cls: 'kokushi-cell-percent' })

    tr.createEl('td', { text: `${row.mastered}/${row.attempted}`, cls: 'kokushi-cell-num' })
    tr.createEl('td', { text: String(row.weak), cls: 'kokushi-cell-num' })
    tr.createEl('td', { text: String(row.untouched), cls: 'kokushi-cell-num' })
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
  const line = parent.createDiv({ cls: 'kokushi-hisshu' })
  line.createSpan({ text: mark })
  renderBar(line, score.rate)
  line.createSpan({
    text:
      `正答 ${score.correct}/${score.attempted}（${percent}%）` +
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

      const exams = presentExams(questions.map((q) => q.exam))
      if (exams.length === 0) {
        el.createEl('p', { text: '問題ノートがありません' })
        return
      }

      const selectWrap = el.createDiv({ cls: 'kokushi-picker-item' })
      selectWrap.createEl('label', { text: '試験' })
      const select = selectWrap.createEl('select', { cls: 'kokushi-select' })
      for (const exam of exams) {
        const optionEl = select.createEl('option', { text: examLabel(exam) })
        optionEl.value = exam
      }

      const body = el.createDiv()

      const draw = (exam: string): void => {
        body.empty()
        const examQuestions = questions.filter((q) => q.exam === exam)

        renderHisshu(body, examQuestions, entries, config.hisshu)

        body.createEl('p', { text: `${examLabel(exam)} 分野別（全体像）`, cls: 'kokushi-section-title' })
        renderRows(
          body,
          aggregateWeakness(examQuestions.map((q) => ({ key: q.field, id: q.id })), states, examDate),
          plugin,
          'field',
        )

        body.createEl('p', {
          text: `10分で潰すならここ（${examLabel(exam)} トピック別ワースト${topicLimit}）`,
          cls: 'kokushi-section-title',
        })
        const topicRows = aggregateWeakness(
          examQuestions.flatMap((q) => q.tags.map((tag) => ({ key: tag, id: q.id }))),
          states,
          examDate,
        ).filter((row) => row.weak > 0)
        renderRows(body, topicRows.slice(0, topicLimit), plugin, 'tag')
      }

      select.value = exams[0]
      select.onchange = () => draw(select.value)
      draw(exams[0])
    } catch (error) {
      el.empty()
      el.createEl('p', { text: RENDER_ERROR })
      console.error('kokushi-srs: 表示に失敗しました', error)
    }
  })
}
