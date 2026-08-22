import { Component, MarkdownRenderer, TFile } from 'obsidian'
import type KokushiPlugin from '../main'
import type { QuestionMeta } from './questionIndex'
import { advance, currentId, isFinished, progress, startSession } from '../core/session'
import { renderAnswerButtons } from './answerBlock'

// フェンス前後の空白・タブや \r\n 改行が入っていても除去できるよう寛容にしておく。
// 万一これでも一致しない場合は、下の残存チェックで console.warn を出す。
const KOKUSHI_BLOCK_RE = /```[ \t]*kokushi[ \t]*\r?\n[ \t]*```[ \t]*\r?\n?/
const KOKUSHI_LEFTOVER_RE = /```[ \t]*kokushi/
const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/

export function renderSession(
  plugin: KokushiPlugin,
  container: HTMLElement,
  questions: QuestionMeta[],
  onExit: () => void
): void {
  const byId = new Map(questions.map((q) => [q.id, q]))
  let state = startSession(questions.map((q) => q.id))

  // 問題ごとの MarkdownRenderer.render に渡す Component。plugin（長寿命）をそのまま
  // 渡すと、描画のたびに生成されるレンダラーの子コンポーネントが unload されずに
  // plugin に蓄積してしまう（リーク）。問題を切り替えるたびに前の Component を
  // unload し、新しい短命な Component を発行する。
  let renderComponent: Component | null = null

  const renderCurrentQuestion = async (): Promise<void> => {
    renderComponent?.unload()
    renderComponent = null
    container.empty()

    if (isFinished(state)) {
      const { total } = progress(state)
      container.createEl('p', { text: `${total}問解きました。` })
      const backBtn = container.createEl('button', { text: '一覧に戻る', cls: 'kokushi-btn' })
      backBtn.addEventListener('click', () => onExit())
      return
    }

    const id = currentId(state)
    const meta = id ? byId.get(id) : undefined
    if (!meta) {
      container.createEl('p', { text: '問題が見つかりませんでした。' })
      addRecoveryButtons(container)
      return
    }

    const file = plugin.app.vault.getAbstractFileByPath(meta.path)
    if (!(file instanceof TFile)) {
      container.createEl('p', { text: `ファイルを読み込めません: ${meta.path}` })
      addRecoveryButtons(container)
      return
    }

    let raw: string
    let body: string
    const questionEl = container.createDiv()
    try {
      raw = await plugin.app.vault.cachedRead(file)
      body = raw.replace(FRONTMATTER_RE, '').replace(KOKUSHI_BLOCK_RE, '')
      if (KOKUSHI_LEFTOVER_RE.test(body)) {
        // 正規表現がフェンスの形式に一致しなかった可能性がある。除去できていないと
        // Obsidian標準のkokushiプロセッサがこのブロックにも反応し、⭕△❌ボタンが
        // 二重に表示されてしまうため、気づけるように警告しておく。
        console.warn(
          `kokushi-srs: kokushiブロックの除去に失敗した可能性があります（${meta.path}）。ボタンが二重表示されていないか確認してください。`
        )
      }

      const component = new Component()
      component.load()
      renderComponent = component
      await MarkdownRenderer.render(plugin.app, body, questionEl, meta.path, component)
    } catch (error) {
      console.error('kokushi-srs: 問題の読み込み・描画に失敗しました', error)
      container.empty()
      container.createEl('p', { text: '問題を読み込めませんでした。' })
      addRecoveryButtons(container)
      return
    }

    questionEl.createEl('p', {
      text: '↑「解説を開く」で正解を確認してから記録してください',
      cls: 'kokushi-hint',
    })

    const abortBtn = questionEl.createEl('button', { text: '中断して一覧に戻る', cls: 'kokushi-btn' })
    abortBtn.addEventListener('click', () => {
      renderComponent?.unload()
      renderComponent = null
      onExit()
    })

    const buttonHost = questionEl.createDiv()
    // 「次へ」はbuttonHostのすぐ下に置く。containerの末尾（解説展開後の一番下）に
    // 置くと、解説が長い問題でボタン群から遠く離れてしまい見つけにくくなるため。
    renderAnswerButtons(plugin, id!, buttonHost, () => {
      const box = questionEl.querySelector('.callout[data-callout="解説"]')
      if (box?.classList.contains('is-collapsed')) {
        ;(box.querySelector('.callout-title') as HTMLElement)?.click()
      }
      // 押し直しで onAnswered が複数回呼ばれても「次へ」が重複しないようにする
      if (questionEl.querySelector('.kokushi-next-btn') !== null) return
      const nextBtn = questionEl.createEl('button', {
        text: '次へ',
        cls: 'kokushi-btn kokushi-btn-primary kokushi-next-btn',
      })
      nextBtn.addEventListener('click', () => {
        state = advance(state)
        void renderCurrentQuestion()
      })
    })
  }

  const addRecoveryButtons = (host: HTMLElement): void => {
    const nextBtn = host.createEl('button', { text: '次へ', cls: 'kokushi-btn' })
    nextBtn.addEventListener('click', () => {
      state = advance(state)
      void renderCurrentQuestion()
    })
    const backBtn = host.createEl('button', { text: '一覧に戻る', cls: 'kokushi-btn' })
    backBtn.addEventListener('click', () => onExit())
  }

  void renderCurrentQuestion()
}
