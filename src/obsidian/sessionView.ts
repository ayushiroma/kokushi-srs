import { MarkdownRenderer, TFile } from 'obsidian'
import type KokushiPlugin from '../main'
import type { QuestionMeta } from './questionIndex'
import { advance, currentId, isFinished, progress, startSession } from '../core/session'
import { renderAnswerButtons } from './answerBlock'

const KOKUSHI_BLOCK_RE = /```kokushi\n```\n?/
const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/

export function renderSession(
  plugin: KokushiPlugin,
  container: HTMLElement,
  questions: QuestionMeta[],
  onExit: () => void
): void {
  const byId = new Map(questions.map((q) => [q.id, q]))
  let state = startSession(questions.map((q) => q.id))

  const renderCurrentQuestion = async (): Promise<void> => {
    container.empty()

    if (isFinished(state)) {
      const { total } = progress(state)
      container.createEl('p', { text: `${total}問解きました。` })
      const backBtn = container.createEl('button', { text: '一覧に戻る' })
      backBtn.addEventListener('click', () => onExit())
      return
    }

    const id = currentId(state)
    const meta = id ? byId.get(id) : undefined
    if (!meta) {
      container.createEl('p', { text: '問題が見つかりませんでした。' })
      return
    }

    const file = plugin.app.vault.getAbstractFileByPath(meta.path)
    if (!(file instanceof TFile)) {
      container.createEl('p', { text: `ファイルを読み込めません: ${meta.path}` })
      return
    }

    const raw = await plugin.app.vault.cachedRead(file)
    const body = raw.replace(FRONTMATTER_RE, '').replace(KOKUSHI_BLOCK_RE, '')

    const questionEl = container.createDiv()
    await MarkdownRenderer.render(plugin.app, body, questionEl, meta.path, plugin)

    const buttonHost = questionEl.createDiv()
    renderAnswerButtons(plugin, id!, buttonHost, () => {
      const callout = questionEl.querySelector('.callout[data-callout="解説"] .callout-title')
      if (callout instanceof HTMLElement) {
        callout.click()
      }
      const nextBtn = container.createEl('button', { text: '次へ' })
      nextBtn.addEventListener('click', () => {
        state = advance(state)
        void renderCurrentQuestion()
      })
    })
  }

  void renderCurrentQuestion()
}
