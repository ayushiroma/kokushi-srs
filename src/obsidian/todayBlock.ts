import { toDateString, diffDays } from '../core/date'
import { masteryPerDay, measuredCapacity } from '../core/pace'
import { buildQueue } from '../core/queue'
import { isMastered } from '../core/srs'
import { buildStates } from '../core/state'
import { earliestExamDate, loadConfig } from './config'
import { indexQuestions, type QuestionMeta } from './questionIndex'
import type KokushiPlugin from '../main'

function renderList(parent: HTMLElement, title: string, metas: QuestionMeta[], plugin: KokushiPlugin): void {
  parent.createEl('p', { text: `【${title}】${metas.length}問`, cls: 'kokushi-section-title' })
  if (metas.length === 0) {
    parent.createEl('p', { text: '　なし' })
    return
  }
  const ul = parent.createEl('ul')
  for (const meta of metas) {
    const li = ul.createEl('li')
    const link = li.createEl('a', { text: `${meta.id}　${meta.field}`, href: '#' })
    link.onclick = (ev) => {
      ev.preventDefault()
      void plugin.app.workspace.openLinkText(meta.path, '', false)
    }
  }
}

export function registerTodayBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-today', async (_source, el) => {
    try {
      el.empty()
      const config = await loadConfig(plugin.app)
      const examDate = earliestExamDate(config)
      const today = toDateString(new Date())
      const entries = await plugin.logStore.readAll()
      const states = buildStates(entries)
      const questions = indexQuestions(plugin.app)
      const byId = new Map(questions.map((q) => [q.id, q]))

      let mastered = 0
      let learning = 0
      for (const [id, state] of states) {
        if (!byId.has(id)) continue
        if (isMastered(state, examDate)) mastered++
        else learning++
      }
      const untouched = questions.length - mastered - learning

      for (const [exam, date] of Object.entries(config.examDates).sort((a, b) => a[1].localeCompare(b[1]))) {
        const name = exam === 'phn' ? '保健師' : exam === 'nurse' ? '看護師' : exam
        el.createEl('p', { text: `${name}まで あと${diffDays(today, date)}日` })
      }

      const percent = questions.length === 0 ? 0 : Math.round((mastered / questions.length) * 100)
      el.createEl('p', { text: `未着手 ${untouched} ｜ 学習中 ${learning} ｜ 定着 ${mastered}　（${percent}%）` })

      const capacity = measuredCapacity(entries)
      if (capacity === null) {
        el.createEl('p', { text: '📊 学習ペースを計測中です。新規問題は「演習.md」から自由に解いてください' })
      } else if (config.showPacing) {
        const rate = masteryPerDay(entries, examDate, today)
        const remaining = questions.length - mastered
        if (rate !== null && rate > 0) {
          const needDays = Math.ceil(remaining / rate)
          const haveDays = diffDays(today, examDate)
          el.createEl('p', {
            text:
              needDays <= haveDays
                ? `このペースなら間に合います（必要 ${needDays}日 / 残り ${haveDays}日）`
                : `⚠️ このペースだと ${needDays - haveDays}日 足りません。1日の問題数を増やすか、範囲を絞ることを検討してください`,
          })
        }
        el.createEl('p', { text: `今日の目安：${capacity}問` })
      }

      const queue = buildQueue({ allIds: questions.map((q) => q.id), states, today, capacity })
      renderList(el, '復習', queue.due.flatMap((id) => byId.get(id) ?? []), plugin)
      renderList(el, '新規', queue.fresh.flatMap((id) => byId.get(id) ?? []), plugin)
    } catch (error) {
      el.empty()
      el.createEl('p', { text: '⚠️ 表示に失敗しました。開発者ツールのコンソールを確認してください' })
      console.error('kokushi-srs: 表示に失敗しました', error)
    }
  })
}
