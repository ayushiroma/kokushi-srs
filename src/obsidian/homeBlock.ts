import { diffDays, toDateString } from '../core/date'
import { examLabel } from '../core/fields'
import { masteryPerDay, measuredCapacity } from '../core/pace'
import { buildQueue } from '../core/queue'
import { isMastered } from '../core/srs'
import { buildStates } from '../core/state'
import { answeredTodayCount } from '../core/todayProgress'
import { earliestExamDate, loadConfig } from './config'
import { RENDER_ERROR } from './messages'
import { openInPreview } from './openInPreview'
import { indexQuestions } from './questionIndex'
import { renderToggleList } from './questionListView'
import { renderSession } from './sessionView'
import type KokushiPlugin from '../main'

const LINKS: ReadonlyArray<{ label: string; path: string }> = [
  { label: '自分で選んで解く', path: '国試対策/画面/自分で選んで解く' },
  { label: '弱点', path: '国試対策/画面/弱点' },
  { label: '知識マップ', path: '国試対策/画面/知識マップ' },
  { label: '使い方', path: '国試対策/画面/使い方' },
]

export function registerHomeBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-home', async (_source, el) => {
    const renderNav = (parent: HTMLElement): void => {
      const nav = parent.createDiv({ cls: 'kokushi-nav' })
      LINKS.forEach((item, i) => {
        if (i > 0) nav.createEl('span', { text: ' ｜ ' })
        const link = nav.createEl('a', { text: item.label, href: '#' })
        link.onclick = (ev) => {
          ev.preventDefault()
          void openInPreview(plugin.app, item.path)
        }
      })
    }

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
        const measured = measuredCapacity(entries)
        const capacity = measured ?? config.defaultCapacity
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

        const btnRow = card.createDiv({ cls: 'kokushi-buttons' })
        const startBtn = btnRow.createEl('button', {
          text: finished ? 'もっと解く' : '今日の分を解く',
          cls: 'kokushi-btn kokushi-btn-primary',
        })

        // 今日出る問題の内訳。1問だけ開きたいときのために残す
        // （ボタンは連続演習に入るだけなので、これが無いと1問を選べない）。
        // 既定は畳んでおく：ここは「今日やることを掴む場所」であって、
        // 問題番号の一覧で埋めてよい場所ではない（2026-08-23のあゆさんの指摘）。
        const room = finished ? capacity : Math.max(1, capacity - done)
        const queue = buildQueue({
          allIds: questions.map((q) => q.id),
          states,
          today,
          capacity: room,
        })
        renderToggleList(
          plugin,
          btnRow,
          card,
          [
            { title: '復習', metas: queue.due.flatMap((id) => byId.get(id) ?? []) },
            { title: '新規', metas: queue.fresh.flatMap((id) => byId.get(id) ?? []) },
          ],
          100,
          '今日の分の一覧'
        )

        // お知らせの置き場所。ここだけ差し替えるようにして、
        // カードや下のリンクごと消さないようにする。
        const notice = card.createDiv({ cls: 'kokushi-hint' })

        startBtn.addEventListener('click', () => {
          startBtn.disabled = true
          notice.empty()
          void (async () => {
            try {
              // 今日すでに解いた分を差し引く。差し引かないと、8/10問まで進めて
              // 戻ってきた人がもう一度押したときに、残り2問ではなく新しく10問出る。
              // 「もっと解く」（今日の分を終えた人）のときだけ、もう1セット分出す。
              // ログは押した時点で読み直す（別の端末で解いた分を取りこぼさないため）。
              const fresh = buildQueue({
                allIds: questions.map((q) => q.id),
                states: buildStates(await plugin.logStore.readAll()),
                today,
                capacity: room,
              })
              const metas = [...fresh.due, ...fresh.fresh].flatMap((id) => byId.get(id) ?? [])
              if (metas.length === 0) {
                notice.setText('今日出す問題がありません。「自分で選んで解く」から選んでください')
                startBtn.disabled = false
                return
              }
              el.empty()
              renderSession(plugin, el, metas, () => {
                void render()
              })
            } catch (error) {
              notice.setText(RENDER_ERROR)
              startBtn.disabled = false
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

        // 試験日に間に合うか。旧「今日の分」ノートにあった機能をここへ移した
        // （2026-08-23、画面をホームに一本化したときに落とさないため）。
        if (config.showPacing && measured !== null) {
          const rate = masteryPerDay(entries, examDate, today)
          if (rate !== null && rate > 0) {
            const needDays = Math.ceil((questions.length - mastered) / rate)
            const haveDays = diffDays(today, examDate)
            el.createEl('p', {
              text:
                needDays <= haveDays
                  ? `このペースなら間に合います（必要 ${needDays}日 / 残り ${haveDays}日）`
                  : `⚠️ このペースだと ${needDays - haveDays}日 足りません。1日の問題数を増やすか、範囲を絞ることを検討してください`,
              cls: 'kokushi-hint',
            })
          }
        }

        // --- 他の画面へのリンク ---
        renderNav(el)
      } catch (error) {
        el.empty()
        el.createEl('p', { text: RENDER_ERROR })
        // ホームは唯一の確実な入口なので、失敗してもここから他の画面へ行けるようにする。
        // リンクまで消すと、Obsidianに慣れていない人は戻る手段が分からなくなる。
        renderNav(el)
        console.error('kokushi-srs: ホームの表示に失敗しました', error)
      }
    }

    await render()
  })
}
