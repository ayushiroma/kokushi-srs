import { EXAM_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS, type Option } from '../core/labels'
import {
  EMPTY_SELECTION,
  buildFilterFromSelection,
  fieldOptionsFor,
  type Selection,
} from '../core/selection'
import { RENDER_ERROR } from './messages'
import { openInPreview } from './openInPreview'
import { filterQuestions } from './queryQuestions'
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

        const matched = await filterQuestions(plugin, buildFilterFromSelection(selection))

        el.createEl('p', { text: `該当 ${matched.length}問`, cls: 'kokushi-picker-count' })

        if (matched.length === 0) {
          el.createEl('p', {
            text: 'この条件に合う問題はありません。条件をゆるめてください',
            cls: 'kokushi-hint',
          })
          return
        }

        const row = el.createDiv({ cls: 'kokushi-buttons' })

        const practiceBtn = row.createEl('button', {
          text: '連続で解く',
          cls: 'kokushi-btn kokushi-btn-primary',
        })
        practiceBtn.addEventListener('click', () => {
          practiceBtn.disabled = true
          void (async () => {
            try {
              const questions = await filterQuestions(plugin, buildFilterFromSelection(selection))
              if (questions.length === 0) {
                practiceBtn.disabled = false
                return
              }
              el.empty()
              renderSession(plugin, el, questions, () => {
                void render()
              })
            } catch (error) {
              el.empty()
              el.createEl('p', { text: RENDER_ERROR })
              console.error('kokushi-srs: 連続演習の開始に失敗しました', error)
            }
          })()
        })

        const listBtn = row.createEl('button', { text: '一覧を見る', cls: 'kokushi-btn' })
        let listEl: HTMLElement | null = null
        listBtn.addEventListener('click', () => {
          if (listEl !== null) {
            listEl.remove()
            listEl = null
            listBtn.setText('一覧を見る')
            return
          }
          listBtn.setText('一覧を隠す')
          const ul = el.createEl('ul')
          listEl = ul
          for (const meta of matched.slice(0, LIST_LIMIT)) {
            const li = ul.createEl('li')
            const link = li.createEl('a', { text: `${meta.id}　${meta.field}`, href: '#' })
            link.onclick = (ev) => {
              ev.preventDefault()
              void openInPreview(plugin.app, meta.path)
            }
          }
          if (matched.length > LIST_LIMIT) {
            ul.createEl('li', {
              text: `…ほか ${matched.length - LIST_LIMIT}問（多いので${LIST_LIMIT}問まで表示しています）`,
            })
          }
        })
      } catch (error) {
        el.empty()
        el.createEl('p', { text: RENDER_ERROR })
        console.error('kokushi-srs: 選ぶUIの表示に失敗しました', error)
      }
    }

    await render()
  })
}
