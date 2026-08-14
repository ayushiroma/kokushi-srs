import { Notice } from 'obsidian'
import { buildStates } from '../core/state'
import type { Result } from '../core/types'
import type KokushiPlugin from '../main'

const LABELS: ReadonlyArray<{ result: Result; label: string }> = [
  { result: 'ok', label: '⭕ 正解' },
  { result: 'vague', label: '△ 迷った' },
  { result: 'wrong', label: '❌ 不正解' },
]

export function registerAnswerBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi', (_source, el, ctx) => {
    const frontmatter = plugin.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter
    const id = frontmatter?.id

    if (typeof id !== 'string' || id.trim() === '') {
      el.createEl('p', { text: '⚠️ この問題ノートに id が設定されていません' })
      return
    }

    const row = el.createDiv({ cls: 'kokushi-buttons' })
    const feedback = el.createDiv({ cls: 'kokushi-feedback' })

    // 連打による二重記録を防ぐ。ボタンがDOMから消えるのは非同期I/Oが終わったあとなので、
    // 「消えたかどうか」では守れない。二重記録されると復習アルゴリズムに2回分適用され、
    // 実際より早く「定着」扱いになってしまう。
    let busy = false

    /** 記録できたら true、失敗したら false（呼び出し側が再試行できるようにする） */
    const record = async (result: Result, reason?: string): Promise<boolean> => {
      if (busy) return false
      busy = true
      try {
        await plugin.logStore.append({
          id,
          at: new Date().toISOString(),
          result,
          ...(reason !== undefined && reason !== '' ? { reason } : {}),
        })
        const states = buildStates(await plugin.logStore.readAll())
        const next = states.get(id)?.nextDue ?? '不明'
        row.empty()
        feedback.setText(`記録しました。次回は ${next}`)
        new Notice(`記録しました（次回 ${next}）`)
        return true
      } catch (error) {
        // 記録が失われたことにユーザーが気づけないのが最悪。必ず画面に出して再試行できるようにする。
        busy = false
        feedback.setText('⚠️ 記録に失敗しました。もう一度押してください')
        new Notice('国試対策：記録に失敗しました')
        console.error('kokushi-srs: 記録に失敗しました', error)
        return false
      }
    }

    for (const { result, label } of LABELS) {
      const button = row.createEl('button', { text: label, cls: 'kokushi-btn' })
      button.onclick = () => {
        if (busy) return
        if (result !== 'wrong') {
          void record(result)
          return
        }
        row.empty()
        feedback.setText('なぜ間違えた？（空欄のままEnterでもOK）')
        const input = el.createEl('input', { cls: 'kokushi-reason', type: 'text' })
        input.focus()
        input.onkeydown = (ev: KeyboardEvent) => {
          if (ev.key !== 'Enter') return
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
  })
}
