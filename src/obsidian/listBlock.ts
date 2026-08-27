import { Notice } from 'obsidian'
import { toDateString } from '../core/date'
import { parseFilter } from '../core/filter'
import { FILTER_KEY_LABELS, formatFilterValue } from '../core/labels'
import { filterQuestions } from './queryQuestions'
import type { QuestionMeta } from './questionIndex'
import { renderToggleList } from './questionListView'
import { renderSession } from './sessionView'
import { RENDER_ERROR } from './messages'
import type KokushiPlugin from '../main'

export async function resolveFilteredQuestions(
  plugin: KokushiPlugin,
  source: string
): Promise<QuestionMeta[]> {
  return filterQuestions(plugin, parseFilter(source))
}

export function registerListBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-list', async (source, el) => {
    const renderList = async (): Promise<void> => {
      try {
        el.empty()
        const filter = parseFilter(source)
        const matched = await resolveFilteredQuestions(plugin, source)

        const conditions = Object.entries(filter)
          .filter(([key]) => key !== 'limit' && key !== 'unknownKeys')
          .map(
            ([key, value]) =>
              `${FILTER_KEY_LABELS[key] ?? key}：${formatFilterValue(key, String(value))}`
          )
          .join(' ｜ ')

        el.createEl('p', {
          text: `${conditions === '' ? '条件なし' : conditions}　該当 ${matched.length}問（${toDateString(new Date())} 時点）`,
        })

        if (filter.unknownKeys.length > 0) {
          el.createEl('p', {
            text: `⚠️ 認識できない条件があります: ${filter.unknownKeys.join(' / ')}`,
          })
        }

        if (matched.length === 0) {
          el.createEl('p', { text: '該当する問題がありません' })
          return
        }

        // 「よく使う条件」はプリセットが縦に並ぶ画面なので、ボタンは1行にまとめる。
        // 一覧は既定で閉じておく（開きっぱなしだと条件が画面外に押し出される）。
        const row = el.createDiv({ cls: 'kokushi-buttons' })

        const practiceBtn = row.createEl('button', {
          text: `連続で解く（${matched.length}問）`,
          cls: 'kokushi-btn',
        })
        practiceBtn.addEventListener('click', () => {
          practiceBtn.disabled = true
          void (async () => {
            try {
              const questions = await resolveFilteredQuestions(plugin, source)
              if (questions.length === 0) {
                new Notice('対象の問題がありません')
                practiceBtn.disabled = false
                return
              }
              el.empty()
              renderSession(plugin, el, questions, () => {
                void renderList()
              })
            } catch (error) {
              el.empty()
              el.createEl('p', { text: RENDER_ERROR })
              console.error('kokushi-srs: 表示に失敗しました', error)
              practiceBtn.disabled = false
            }
          })()
        })

        renderToggleList(plugin, row, el, [{ title: null, metas: matched }], filter.limit)
      } catch (error) {
        el.empty()
        el.createEl('p', { text: RENDER_ERROR })
        console.error('kokushi-srs: 表示に失敗しました', error)
      }
    }

    await renderList()
  })
}
