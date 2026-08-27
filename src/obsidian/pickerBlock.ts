import { isExamModeSelection } from '../core/examScore'
import { EXAM_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS, type Option } from '../core/labels'
import {
  EMPTY_SELECTION,
  buildFilterFromSelection,
  fieldOptionsFor,
  type Selection,
} from '../core/selection'
import { RENDER_ERROR } from './messages'
import { filterQuestions } from './queryQuestions'
import { renderToggleList } from './questionListView'
import { renderSession } from './sessionView'
import type KokushiPlugin from '../main'

/** 前回選んだ条件を覚えておく。続きから再開できるようにするため */
interface PickerData {
  selection?: Selection
}

const ROUND_OPTIONS: readonly Option[] = [
  { value: '', label: 'すべて' },
  ...[115, 114, 113, 112, 111, 110, 109, 108].map((r) => ({ value: String(r), label: `第${r}回` })),
]

/** 一覧に出す上限。全件並べるとノートが極端に長くなる */
const LIST_LIMIT = 100

export function registerPickerBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-picker', async (_source, el) => {
    const saved = ((await plugin.loadData()) ?? {}) as PickerData
    let selection: Selection = { ...EMPTY_SELECTION, ...saved.selection }

    const render = async (): Promise<void> => {
      try {
        el.empty()
        const controls = el.createDiv({ cls: 'kokushi-picker' })

        const addSelect = (
          label: string,
          options: readonly Option[],
          current: string,
          onChange: (v: string) => void
        ): void => {
          const wrap = controls.createDiv({ cls: 'kokushi-picker-item' })
          wrap.createEl('label', { text: label })
          const select = wrap.createEl('select', { cls: 'kokushi-select' })
          for (const opt of options) {
            const optionEl = select.createEl('option', { text: opt.label })
            optionEl.value = opt.value
            if (opt.value === current) optionEl.selected = true
          }
          select.onchange = () => {
            onChange(select.value)
            void plugin.saveData({ ...saved, selection })
            void render()
          }
        }

        addSelect('試験', EXAM_OPTIONS, selection.exam, (v) => {
          // 試験を変えたら分野の一覧が変わるので、噛み合わなくなった分野は解除する
          selection = { ...selection, exam: v, field: '' }
        })

        const fieldOptions: readonly Option[] = [
          { value: '', label: 'すべて' },
          ...fieldOptionsFor(selection.exam).map((f) => ({ value: f, label: f })),
        ]
        addSelect('分野', fieldOptions, selection.field, (v) => {
          selection = { ...selection, field: v }
        })

        addSelect('種別', TYPE_OPTIONS, selection.type, (v) => {
          selection = { ...selection, type: v }
        })
        addSelect('状態', STATUS_OPTIONS, selection.status, (v) => {
          selection = { ...selection, status: v }
        })
        addSelect('年度', ROUND_OPTIONS, selection.round, (v) => {
          selection = { ...selection, round: v }
        })

        const isEmpty = Object.values(selection).every((v) => v === '')
        const clearBtn = controls.createEl('button', {
          text: 'クリア',
          cls: 'kokushi-btn kokushi-picker-clear',
        })
        clearBtn.disabled = isEmpty
        clearBtn.addEventListener('click', () => {
          selection = { ...EMPTY_SELECTION }
          void plugin.saveData({ ...saved, selection })
          void render()
        })

        const filter = buildFilterFromSelection(selection)
        const matched = await filterQuestions(plugin, filter)

        el.createEl('p', { text: `該当 ${matched.length}問`, cls: 'kokushi-picker-count' })

        if (matched.length === 0) {
          el.createEl('p', {
            text: 'この条件に合う問題はありません。条件をゆるめてください',
            cls: 'kokushi-hint',
          })
          return
        }

        const row = el.createDiv({ cls: 'kokushi-buttons' })

        // 1回のセッションに入れる上限。filterQuestions は絞り込むだけで
        // 件数を切らないので、上限はここで掛ける。
        // 何問で始まるかはボタンに出す（黙って減らさない）。
        const sessionCount = Math.min(matched.length, filter.limit)

        const practiceBtn = row.createEl('button', {
          text: `連続で解く（${sessionCount}問）`,
          cls: 'kokushi-btn kokushi-btn-primary',
        })
        practiceBtn.addEventListener('click', () => {
          practiceBtn.disabled = true
          const examMode = isExamModeSelection(selection)
          void (async () => {
            try {
              const questions = (await filterQuestions(plugin, filter)).slice(0, filter.limit)
              if (questions.length === 0) {
                practiceBtn.disabled = false
                return
              }
              el.empty()
              renderSession(
                plugin,
                el,
                questions,
                () => {
                  void render()
                },
                examMode
              )
            } catch (error) {
              el.empty()
              el.createEl('p', { text: RENDER_ERROR })
              console.error('kokushi-srs: 連続演習の開始に失敗しました', error)
            }
          })()
        })

        if (matched.length > sessionCount) {
          el.createEl('p', {
            text: `※ 一度に解けるのは ${sessionCount}問までです。条件を絞ると狙ったところから解けます`,
            cls: 'kokushi-hint',
          })
        }

        renderToggleList(plugin, row, el, [{ title: null, metas: matched }], LIST_LIMIT)
      } catch (error) {
        el.empty()
        el.createEl('p', { text: RENDER_ERROR })
        console.error('kokushi-srs: 選ぶUIの表示に失敗しました', error)
      }
    }

    await render()
  })
}
