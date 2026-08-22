import { diffDays, toDateString } from '../core/date'
import { examLabel } from '../core/fields'
import { measuredCapacity } from '../core/pace'
import { buildQueue } from '../core/queue'
import { isMastered } from '../core/srs'
import { buildStates } from '../core/state'
import { answeredTodayCount } from '../core/todayProgress'
import { earliestExamDate, loadConfig } from './config'
import { RENDER_ERROR } from './messages'
import { openInPreview } from './openInPreview'
import { indexQuestions } from './questionIndex'
import { renderSession } from './sessionView'
import type KokushiPlugin from '../main'

const LINKS: ReadonlyArray<{ label: string; path: string }> = [
  { label: '自分で選んで解く', path: '国試対策/自分で選んで解く' },
  { label: '弱点', path: '国試対策/弱点' },
  { label: '知識マップ', path: '国試対策/知識マップ' },
  { label: '使い方', path: '国試対策/使い方' },
]

export function registerHomeBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-home', async (_source, el) => {
    const render = async (): Promise<void> => {
      try {
        el.empty()
        const config = await loadConfig(plugin.app)
        const examDate = earliestExamDate(config)
        const today = toDateString(new Date())
        const entries = await plugin.logStore.readAll()
        const states = buildStates(entries)
        const questions = indexQuestions(plugin.app)
        const byId = new Map(questions.map((q) => [q.id, q]))

        // --- 残り日数 ---
        const countdown = Object.entries(config.examDates)
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([exam, date]) => `${examLabel(exam)}まで あと${diffDays(today, date)}日`)
          .join('　／　')
        el.createEl('p', { text: countdown, cls: 'kokushi-countdown' })

        // --- 今日の分（主役） ---
        const capacity = measuredCapacity(entries) ?? config.defaultCapacity
        const done = answeredTodayCount(entries, today)
        const finished = done >= capacity

        const card = el.createDiv({ cls: 'kokushi-card' })
        card.createEl('p', {
          text: finished ? '今日の分は終わりです。おつかれさま' : `今日の分　${done} / ${capacity}問`,
          cls: 'kokushi-card-title',
        })

        const bar = card.createDiv({ cls: 'kokushi-bar' })
        const fill = bar.createDiv({ cls: 'kokushi-bar-fill' })
        fill.style.width = `${Math.min(100, Math.round((done / capacity) * 100))}%`

        const startBtn = card.createEl('button', {
          text: finished ? 'もっと解く' : '今日の分を解く',
          cls: 'kokushi-btn kokushi-btn-primary',
        })
        startBtn.addEventListener('click', () => {
          startBtn.disabled = true
          void (async () => {
            try {
              const queue = buildQueue({
                allIds: questions.map((q) => q.id),
                states: buildStates(await plugin.logStore.readAll()),
                today,
                capacity,
              })
              const metas = [...queue.due, ...queue.fresh].flatMap((id) => byId.get(id) ?? [])
              if (metas.length === 0) {
                el.empty()
                el.createEl('p', {
                  text: '今日出す問題がありません。「自分で選んで解く」から選んでください',
                })
                return
              }
              el.empty()
              renderSession(plugin, el, metas, () => {
                void render()
              })
            } catch (error) {
              el.empty()
              el.createEl('p', { text: RENDER_ERROR })
              console.error('kokushi-srs: 連続演習の開始に失敗しました', error)
            }
          })()
        })

        // --- 全体の進捗（控えめに） ---
        let mastered = 0
        for (const [id, state] of states) {
          if (byId.has(id) && isMastered(state, examDate)) mastered++
        }
        const percent = questions.length === 0 ? 0 : Math.round((mastered / questions.length) * 100)
        el.createEl('p', {
          text: `ぜんぶで ${questions.length}問中 ${mastered}問を覚えました（${percent}%）`,
          cls: 'kokushi-total',
        })
        el.createEl('p', {
          text: 'ⓘ 覚えた＝2回続けて正解し、次の復習が試験日より後になった問題',
          cls: 'kokushi-hint',
        })

        // --- 他の画面へのリンク ---
        const nav = el.createDiv({ cls: 'kokushi-nav' })
        LINKS.forEach((item, i) => {
          if (i > 0) nav.createEl('span', { text: ' ｜ ' })
          const link = nav.createEl('a', { text: item.label, href: '#' })
          link.onclick = (ev) => {
            ev.preventDefault()
            void openInPreview(plugin.app, item.path)
          }
        })
      } catch (error) {
        el.empty()
        el.createEl('p', { text: RENDER_ERROR })
        console.error('kokushi-srs: ホームの表示に失敗しました', error)
      }
    }

    await render()
  })
}
