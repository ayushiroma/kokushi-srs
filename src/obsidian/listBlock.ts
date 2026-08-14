import { toDateString } from '../core/date'
import { parseFilter } from '../core/filter'
import { isMastered } from '../core/srs'
import { buildStates } from '../core/state'
import { earliestExamDate, loadConfig } from './config'
import { indexQuestions, type QuestionMeta } from './questionIndex'
import type KokushiPlugin from '../main'

export function registerListBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-list', async (source, el) => {
    el.empty()
    const filter = parseFilter(source)
    const config = await loadConfig(plugin.app)
    const examDate = earliestExamDate(config)
    const states = buildStates(await plugin.logStore.readAll())

    const matched = indexQuestions(plugin.app).filter((q: QuestionMeta) => {
      if (filter.field !== undefined && q.field !== filter.field) return false
      if (filter.exam !== undefined && q.exam !== filter.exam) return false
      if (filter.round !== undefined && q.round !== filter.round) return false
      if (filter.session !== undefined && q.session !== filter.session) return false
      if (filter.tag !== undefined && !q.tags.includes(filter.tag)) return false
      if (filter.status !== undefined) {
        const state = states.get(q.id)
        if (filter.status === '未解答' && state !== undefined) return false
        if (filter.status === '定着' && (state === undefined || !isMastered(state, examDate))) return false
        if (filter.status === '苦手' && (state === undefined || isMastered(state, examDate) || state.streak > 0)) {
          return false
        }
      }
      return true
    })

    const shown = matched.slice(0, filter.limit)
    const conditions = Object.entries(filter)
      .filter(([key]) => key !== 'limit')
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ｜ ')

    el.createEl('p', {
      text: `${conditions === '' ? '条件なし' : conditions}　該当 ${matched.length}問 中 ${shown.length}問を表示（${toDateString(new Date())} 時点）`,
    })

    if (shown.length === 0) {
      el.createEl('p', { text: '該当する問題がありません' })
      return
    }

    const ul = el.createEl('ul')
    for (const meta of shown) {
      const li = ul.createEl('li')
      const link = li.createEl('a', { text: `${meta.id}　${meta.field}`, href: '#' })
      link.onclick = (ev) => {
        ev.preventDefault()
        void plugin.app.workspace.openLinkText(meta.path, '', false)
      }
    }
  })
}
