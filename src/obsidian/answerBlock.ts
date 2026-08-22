import { Notice, TFile } from 'obsidian'
import { judge, parseChoiceNumbers } from '../core/choices'
import { buildStates } from '../core/state'
import type { Result } from '../core/types'
import type KokushiPlugin from '../main'

const LABELS: ReadonlyArray<{ result: Result; label: string }> = [
  { result: 'ok', label: '⭕ 正解' },
  { result: 'vague', label: '△ 迷った' },
  { result: 'wrong', label: '❌ 不正解' },
]

export interface AnswerOptions {
  /** 選択肢の番号。空なら番号ボタンを出さず、⭕△❌だけを出す */
  choices: number[]
  /** frontmatter の answer。空なら番号ボタンを出さない */
  answer: number[]
  onAnswered?: (result: Result) => void
}

export function renderAnswerButtons(
  plugin: KokushiPlugin,
  questionId: string,
  container: HTMLElement,
  options: AnswerOptions
): void {
  const id = questionId
  const el = container
  const { choices, answer, onAnswered } = options

  const choiceRow = el.createDiv({ cls: 'kokushi-choices' })
  const verdict = el.createDiv({ cls: 'kokushi-verdict' })
  const changeArea = el.createDiv({ cls: 'kokushi-change-area' })
  const reasonArea = el.createDiv({ cls: 'kokushi-reason-area' })
  const feedback = el.createDiv({ cls: 'kokushi-feedback' })

  // 連打による二重記録を防ぐ。ボタンがDOMから消えるのは非同期I/Oが終わったあとなので、
  // 「消えたかどうか」では守れない。二重記録されると復習アルゴリズムに2回分適用され、
  // 実際より早く「定着」扱いになってしまう。
  let busy = false

  const resultButtons = new Map<Result, HTMLButtonElement>()

  const markSelected = (result: Result): void => {
    for (const [r, btn] of resultButtons) {
      btn.toggleClass('kokushi-btn-selected', r === result)
    }
  }

  /** 記録できたら true、失敗したら false（呼び出し側が再試行できるようにする） */
  const record = async (
    result: Result,
    extra?: { reason?: string; chosen?: number[] }
  ): Promise<boolean> => {
    if (busy) return false
    busy = true

    // 記録そのものの成否と、記録後の表示の成否は分けて扱う。
    // まとめて catch すると「記録は成功したのに失敗と表示」→ 再試行で二重記録、という
    // 気づけないデータ破壊が起きる。
    try {
      await plugin.logStore.append({
        id,
        at: new Date().toISOString(),
        result,
        ...(extra?.reason !== undefined && extra.reason !== '' ? { reason: extra.reason } : {}),
        ...(extra?.chosen !== undefined && extra.chosen.length > 0 ? { chosen: extra.chosen } : {}),
      })
    } catch (error) {
      busy = false
      feedback.setText('⚠️ 記録に失敗しました。もう一度押してください')
      new Notice('国試対策：記録に失敗しました')
      console.error('kokushi-srs: 記録に失敗しました', error)
      return false
    }

    // ここから先は記録済み。表示に失敗しても「成功」として扱う（再試行させない）。
    busy = false
    markSelected(result)
    try {
      const states = buildStates(await plugin.logStore.readAll())
      const next = states.get(id)?.nextDue ?? '不明'
      feedback.setText(`次回は ${next}`)
      new Notice(`記録しました（次回 ${next}）`)
    } catch (error) {
      feedback.setText('記録しました（次回の復習日は取得できませんでした）')
      new Notice('記録しました')
      console.error('kokushi-srs: 次回復習日の計算に失敗しました', error)
    }
    onAnswered?.(result)
    return true
  }

  /** ⭕△❌ボタンを作る。判定後は「記録を直す」ためのボタンとして働く */
  const buildResultButtons = (host: HTMLElement, withLabel: boolean): void => {
    if (withLabel) host.createEl('span', { text: '変えるなら', cls: 'kokushi-change-label' })
    const row = host.createDiv({ cls: 'kokushi-buttons' })
    for (const { result, label } of LABELS) {
      const button = row.createEl('button', { text: label, cls: 'kokushi-btn' })
      resultButtons.set(result, button)
      button.onclick = () => {
        if (busy) return
        reasonArea.empty()
        if (result !== 'wrong') {
          void record(result)
          return
        }
        // ❌に直したときは記録を先に済ませ、メモは任意にする。
        // 入力を必須にすると、友達には手間が離脱の原因になる。
        void record('wrong')
        const memoBtn = reasonArea.createEl('button', {
          text: 'メモを残す（任意）',
          cls: 'kokushi-btn-quiet',
        })
        memoBtn.onclick = () => {
          memoBtn.remove()
          const input = reasonArea.createEl('input', { cls: 'kokushi-reason', type: 'text' })
          input.placeholder = 'なぜ間違えた？'
          input.focus()
          input.onkeydown = (ev: KeyboardEvent) => {
            if (ev.key !== 'Enter') return
            // 日本語入力の変換確定Enterを拾わない（漢字を確定した瞬間に記録が走ってしまう）
            if (ev.isComposing) return
            if (busy) return
            input.disabled = true
            void record('wrong', { reason: input.value.trim() }).then((ok) => {
              if (ok) {
                input.remove()
              } else {
                input.disabled = false
                input.focus()
              }
            })
          }
        }
      }
    }
  }

  // --- フォールバック：選択肢が取れないときは今までどおり⭕△❌だけを出す ---
  if (choices.length === 0 || answer.length === 0) {
    buildResultButtons(changeArea, false)
    return
  }

  // --- 番号タップ式 ---
  const selected = new Set<number>()
  const choiceButtons = new Map<number, HTMLButtonElement>()
  let judged = false

  const reveal = (result: Result): void => {
    judged = true
    for (const [n, btn] of choiceButtons) {
      btn.disabled = true
      const isAnswer = answer.includes(n)
      const isChosen = selected.has(n)
      // 記号を必ず付ける。色だけだと見分けられない人がいる
      if (isAnswer) {
        btn.setText(`${n} ⭕`)
        btn.addClass('kokushi-choice-answer')
      } else if (isChosen) {
        btn.setText(`${n} ❌`)
        btn.addClass('kokushi-choice-missed')
      }
    }
    verdict.setText(result === 'ok' ? '記録：⭕ 正解' : '記録：❌ 不正解')
    verdict.addClass(result === 'ok' ? 'kokushi-verdict-ok' : 'kokushi-verdict-wrong')
    buildResultButtons(changeArea, true)
    markSelected(result)
  }

  for (const n of choices) {
    const button = choiceRow.createEl('button', {
      text: String(n),
      cls: 'kokushi-btn kokushi-choice',
    })
    choiceButtons.set(n, button)
    button.onclick = () => {
      if (judged || busy) return
      // 押し間違えたら押し直して解除できる
      if (selected.has(n)) {
        selected.delete(n)
        button.removeClass('kokushi-choice-selected')
        return
      }
      selected.add(n)
      button.addClass('kokushi-choice-selected')
      if (selected.size < answer.length) return

      const chosen = [...selected].sort((a, b) => a - b)
      const result = judge(chosen, answer)
      reveal(result)
      void record(result, { chosen })
    }
  }

  if (answer.length > 1) {
    el.createEl('p', { text: `${answer.length}つ選んでください`, cls: 'kokushi-hint' })
  }
}

/** frontmatter の answer を number[] にする。壊れていたら空を返す */
export function readAnswer(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const nums = value.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0)
  return nums.length === value.length && nums.length > 0 ? nums : []
}

export function registerAnswerBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi', async (_source, el, ctx) => {
    const frontmatter = plugin.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter
    const id = frontmatter?.id

    if (typeof id !== 'string' || id.trim() === '') {
      el.createEl('p', { text: '⚠️ この問題ノートに id が設定されていません' })
      return
    }

    // 選択肢は本文から読む。frontmatterには入っていない（1,675ファイルを書き換えないため）
    let choices: number[] = []
    const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath)
    if (file instanceof TFile) {
      try {
        choices = parseChoiceNumbers(await plugin.app.vault.cachedRead(file))
      } catch (error) {
        console.error('kokushi-srs: 選択肢の読み取りに失敗しました', error)
      }
    }

    renderAnswerButtons(plugin, id, el, { choices, answer: readAnswer(frontmatter?.answer) })
  })
}
