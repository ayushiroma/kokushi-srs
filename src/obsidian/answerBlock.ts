import { Notice, TFile } from 'obsidian'
import { judge, parseChoiceNumbers } from '../core/choices'
import { buildStates } from '../core/state'
import type { Result } from '../core/types'
import { findChoiceList } from './choiceList'
import { revealExplanation } from './explanation'
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
  /**
   * 描画済みの選択肢リストを探す範囲。
   * 見つかれば行全体をボタンにし、見つからなければ番号ボタンを並べる。
   */
  choiceRoot?: HTMLElement | null
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
  const { choices, answer, choiceRoot, onAnswered } = options

  // 判定結果の置き場所。選択肢リストが見つかったらそのすぐ下へ移す。
  // 押した結果が目に入らない位置（関連知識より下）に出ていたため。
  const resultHost = el.createDiv({ cls: 'kokushi-result' })
  const verdict = resultHost.createDiv({ cls: 'kokushi-verdict' })
  const changeArea = resultHost.createDiv({ cls: 'kokushi-change-area' })
  const reasonArea = resultHost.createDiv({ cls: 'kokushi-reason-area' })
  const feedback = resultHost.createDiv({ cls: 'kokushi-feedback' })

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

  /**
   * ⭕△❌ボタンを作る。判定後は「記録を直す」ためのボタンとして働く。
   * 「変えるなら」のようなラベルは付けない（あゆさん判断：見れば分かる）。
   */
  const buildResultButtons = (host: HTMLElement): void => {
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
    buildResultButtons(changeArea)
    return
  }

  // --- 選択肢を押す方式 ---
  const selected = new Set<number>()
  /** 番号 → 押せる要素。行全体か、番号ボタンのどちらか */
  const pickables = new Map<number, HTMLElement>()
  let judged = false

  const list = choiceRoot != null ? findChoiceList(choiceRoot, choices.length) : null

  // 何個選ぶのかは、押す前に見える場所に出す。
  // 選択肢より下に出していたため「一つしか選べないのか分からない」となっていた。
  const guide =
    answer.length > 1 ? createDiv({ cls: 'kokushi-guide' }) : null
  const updateGuide = (): void => {
    if (guide === null) return
    guide.setText(`${answer.length}つ選んでください（${selected.size}つ選択中）`)
  }

  const reveal = (result: Result): void => {
    judged = true
    for (const [n, node] of pickables) {
      node.addClass('kokushi-picked-done')
      if (node instanceof HTMLButtonElement) node.disabled = true
      const isAnswer = answer.includes(n)
      const isChosen = selected.has(n)
      // 記号を必ず付ける。色だけだと見分けられない人がいる
      if (isAnswer) {
        node.addClass('kokushi-choice-answer')
        node.createSpan({ text: ' ⭕', cls: 'kokushi-mark' })
      } else if (isChosen) {
        node.addClass('kokushi-choice-missed')
        node.createSpan({ text: ' ❌', cls: 'kokushi-mark' })
      }
    }
    guide?.remove()
    verdict.setText(result === 'ok' ? '記録：⭕ 正解' : '記録：❌ 不正解')
    verdict.addClass(result === 'ok' ? 'kokushi-verdict-ok' : 'kokushi-verdict-wrong')
    buildResultButtons(changeArea)
    markSelected(result)
  }

  const pick = (n: number, node: HTMLElement): void => {
    if (judged || busy) return
    // 押し間違えたら押し直して解除できる
    if (selected.has(n)) {
      selected.delete(n)
      node.removeClass('kokushi-choice-selected')
      updateGuide()
      return
    }
    selected.add(n)
    node.addClass('kokushi-choice-selected')
    updateGuide()
    if (selected.size < answer.length) return

    const chosen = [...selected].sort((a, b) => a - b)
    const result = judge(chosen, answer)
    reveal(result)
    void record(result, { chosen })
  }

  if (list !== null) {
    // 描画済みの選択肢リストが見つかった。行全体を押せるようにする。
    const items = Array.from(list.querySelectorAll(':scope > li'))
    items.forEach((li, index) => {
      const n = index + 1
      const node = li as HTMLElement
      node.addClass('kokushi-choice-row')
      node.setAttribute('role', 'button')
      node.setAttribute('tabindex', '0')
      pickables.set(n, node)
      node.onclick = () => pick(n, node)
      node.onkeydown = (ev: KeyboardEvent) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return
        ev.preventDefault()
        pick(n, node)
      }
    })
    if (guide !== null) list.insertAdjacentElement('beforebegin', guide)
    else list.insertAdjacentElement('beforebegin', createDiv({ cls: 'kokushi-guide-spacer' }))
    // 判定結果を選択肢のすぐ下へ移す
    list.insertAdjacentElement('afterend', resultHost)
  } else {
    // 見つからなかった。従来どおり番号ボタンを並べる。
    if (guide !== null) el.insertBefore(guide, resultHost)
    const row = createDiv({ cls: 'kokushi-choices' })
    el.insertBefore(row, resultHost)
    for (const n of choices) {
      const button = row.createEl('button', {
        text: String(n),
        cls: 'kokushi-btn kokushi-choice',
      })
      pickables.set(n, button)
      button.onclick = () => pick(n, button)
    }
  }

  updateGuide()
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

    // 単体表示では、選択肢も解説もこのブロックの外側（ノート全体）に描画されている。
    // 閲覧ビューのコンテナを辿って、その中から探す。
    const noteRoot = (el.closest('.markdown-preview-view') ??
      el.closest('.markdown-rendered') ??
      el.ownerDocument.body) as HTMLElement

    renderAnswerButtons(plugin, id, el, {
      choices,
      answer: readAnswer(frontmatter?.answer),
      choiceRoot: noteRoot,
      // 単体表示でも解説が自動で開くようにする。
      // これまで sessionView にしか無く、ノートを直接開いたときは開かなかった。
      onAnswered: () => {
        revealExplanation(plugin.app, noteRoot, ctx.sourcePath)
      },
    })
  })
}
