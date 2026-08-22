import { Notice } from 'obsidian'
import { buildStates } from '../core/state'
import type { Result } from '../core/types'
import type KokushiPlugin from '../main'

const LABELS: ReadonlyArray<{ result: Result; label: string }> = [
  { result: 'ok', label: '⭕ 正解' },
  { result: 'vague', label: '△ 迷った' },
  { result: 'wrong', label: '❌ 不正解' },
]

export function renderAnswerButtons(
  plugin: KokushiPlugin,
  questionId: string,
  container: HTMLElement,
  onAnswered?: (result: Result) => void
): void {
  const id = questionId
  const el = container

  const row = el.createDiv({ cls: 'kokushi-buttons' })
  const reasonArea = el.createDiv({ cls: 'kokushi-reason-area' })
  const feedback = el.createDiv({ cls: 'kokushi-feedback' })

  // 連打による二重記録を防ぐ。ボタンがDOMから消えるのは非同期I/Oが終わったあとなので、
  // 「消えたかどうか」では守れない。二重記録されると復習アルゴリズムに2回分適用され、
  // 実際より早く「定着」扱いになってしまう。
  let busy = false

  const buttons = new Map<Result, HTMLButtonElement>()

  // 押し直しは許可する（最後の記録が正として扱われる設計、buildStates参照）。
  // ボタンは消さず、選んだものだけ色を変えて「今どれを選んでいるか」を見えるようにする。
  const markSelected = (result: Result): void => {
    for (const [r, btn] of buttons) {
      btn.toggleClass('kokushi-btn-selected', r === result)
    }
  }

  /** 記録できたら true、失敗したら false（呼び出し側が再試行できるようにする） */
  const record = async (result: Result, reason?: string): Promise<boolean> => {
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
        ...(reason !== undefined && reason !== '' ? { reason } : {}),
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
      feedback.setText(`記録しました。次回は ${next}（押し直すと変更できます）`)
      new Notice(`記録しました（次回 ${next}）`)
    } catch (error) {
      feedback.setText('記録しました（次回の復習日は取得できませんでした）')
      new Notice('記録しました')
      console.error('kokushi-srs: 次回復習日の計算に失敗しました', error)
    }
    onAnswered?.(result)
    return true
  }

  for (const { result, label } of LABELS) {
    const button = row.createEl('button', { text: label, cls: 'kokushi-btn' })
    buttons.set(result, button)
    button.onclick = () => {
      if (busy) return
      if (result !== 'wrong') {
        reasonArea.empty()
        void record(result)
        return
      }
      reasonArea.empty()
      feedback.setText('なぜ間違えた？（空欄のままEnterでもOK）')
      const input = reasonArea.createEl('input', { cls: 'kokushi-reason', type: 'text' })
      input.focus()
      input.onkeydown = (ev: KeyboardEvent) => {
        if (ev.key !== 'Enter') return
        // 日本語入力の変換確定Enterを拾わない（漢字を確定した瞬間に記録が走ってしまう）
        if (ev.isComposing) return
        if (busy) return
        input.disabled = true
        void record('wrong', input.value.trim()).then((ok) => {
          if (ok) {
            input.remove()
          } else {
            // 失敗したら入力内容を残したまま再試行できるようにする
            input.disabled = false
            input.focus()
          }
        })
      }
    }
  }
}

export function registerAnswerBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi', (_source, el, ctx) => {
    const frontmatter = plugin.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter
    const id = frontmatter?.id

    if (typeof id !== 'string' || id.trim() === '') {
      el.createEl('p', { text: '⚠️ この問題ノートに id が設定されていません' })
      return
    }

    renderAnswerButtons(plugin, id, el)
  })
}
