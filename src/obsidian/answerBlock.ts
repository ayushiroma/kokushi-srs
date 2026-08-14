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

    if (typeof id !== 'string' || id === '') {
      el.createEl('p', { text: '⚠️ この問題ノートに id が設定されていません' })
      return
    }

    const row = el.createDiv({ cls: 'kokushi-buttons' })
    const feedback = el.createDiv({ cls: 'kokushi-feedback' })

    const record = async (result: Result, reason?: string): Promise<void> => {
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
    }

    for (const { result, label } of LABELS) {
      const button = row.createEl('button', { text: label, cls: 'kokushi-btn' })
      button.onclick = async () => {
        if (result !== 'wrong') {
          await record(result)
          return
        }
        row.empty()
        feedback.setText('なぜ間違えた？（空欄のままEnterでもOK）')
        const input = el.createEl('input', { cls: 'kokushi-reason', type: 'text' })
        input.focus()
        input.onkeydown = async (ev: KeyboardEvent) => {
          if (ev.key !== 'Enter') return
          const reason = input.value.trim()
          input.remove()
          await record('wrong', reason)
        }
      }
    }
  })
}
