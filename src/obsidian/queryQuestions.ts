import type { Filter } from '../core/filter'
import { isHisshu } from '../core/hisshu'
import { isMastered } from '../core/srs'
import { buildStates } from '../core/state'
import { earliestExamDate, loadConfig } from './config'
import { indexQuestions, type QuestionMeta } from './questionIndex'
import type KokushiPlugin from '../main'

export async function filterQuestions(
  plugin: KokushiPlugin,
  filter: Filter
): Promise<QuestionMeta[]> {
  const config = await loadConfig(plugin.app)
  const examDate = earliestExamDate(config)
  const states = buildStates(await plugin.logStore.readAll())

  return indexQuestions(plugin.app).filter((q: QuestionMeta) => {
    if (filter.field !== undefined && q.field !== filter.field) return false
    if (filter.exam !== undefined && q.exam !== filter.exam) return false
    if (filter.round !== undefined && q.round !== filter.round) return false
    if (filter.session !== undefined && q.session !== filter.session) return false
    if (filter.tag !== undefined && !q.tags.includes(filter.tag)) return false
    if (filter.type !== undefined) {
      const hisshu = isHisshu(q, config.hisshu)
      if (filter.type === '必修' && !hisshu) return false
      if (filter.type === '一般' && hisshu) return false
    }
    if (filter.status !== undefined) {
      const state = states.get(q.id)
      if (filter.status === '未解答' && state !== undefined) return false
      if (filter.status === '定着' && (state === undefined || !isMastered(state, examDate))) return false
      if (
        filter.status === '苦手' &&
        (state === undefined || isMastered(state, examDate) || state.streak > 0)
      ) {
        return false
      }
    }
    return true
  })
}
