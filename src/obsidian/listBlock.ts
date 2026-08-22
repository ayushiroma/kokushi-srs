import { Notice } from 'obsidian'
import { toDateString } from '../core/date'
import { parseFilter } from '../core/filter'
import { openInPreview } from './openInPreview'
import { filterQuestions } from './queryQuestions'
import type { QuestionMeta } from './questionIndex'
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

        const shown = matched.slice(0, filter.limit)
        const conditions = Object.entries(filter)
          .filter(([key]) => key !== 'limit' && key !== 'unknownKeys')
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(' ｜ ')

        el.createEl('p', {
          text: `${conditions === '' ? '条件なし' : conditions}　該当 ${matched.length}問 中 ${shown.length}問を表示（${toDateString(new Date())} 時点）`,
        })

        if (filter.unknownKeys.length > 0) {
          el.createEl('p', {
            text: `⚠️ 認識できない条件があります: ${filter.unknownKeys.join(' / ')}`,
          })
        }

        if (shown.length === 0) {
          el.createEl('p', { text: '該当する問題がありません' })
          return
        }

        const practiceBtn = el.createEl('button', {
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

        const ul = el.createEl('ul')
        for (const meta of shown) {
          const li = ul.createEl('li')
          const link = li.createEl('a', { text: `${meta.id}　${meta.field}`, href: '#' })
          link.onclick = (ev) => {
            ev.preventDefault()
            void openInPreview(plugin.app, meta.path)
          }
        }
      } catch (error) {
        el.empty()
        el.createEl('p', { text: RENDER_ERROR })
        console.error('kokushi-srs: 表示に失敗しました', error)
      }
    }

    await renderList()
  })
}
