import { Component, MarkdownRenderer, TFile } from 'obsidian'
import type KokushiPlugin from '../main'
import type { QuestionMeta } from './questionIndex'
import { advance, currentId, isFinished, progress, startSession } from '../core/session'
import { parseChoiceNumbers } from '../core/choices'
import { NEXT_HOST_CLASS, readAnswer, renderAnswerButtons } from './answerBlock'
import { revealExplanation } from './explanation'

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

  /**
   * 次の問題を描いたら、描画先を画面の上端に合わせる。
   *
   * 同じ場所を空にして描き直しているだけなので、スクロール位置は前の問題のまま残る。
   * 解説まで読み下げてから「次へ」を押すと、次の問題は途中から表示されて
   * 毎回自分で上に戻すことになる（2026-08-22の実機確認であゆさんから指摘）。
   *
   * behavior は指定しない。スムーススクロールにすると問題が切り替わるたびに
   * 画面が流れて目が疲れる。
   */
  const scrollToTop = (): void => {
    container.scrollIntoView({ block: 'start' })
  }

  const renderCurrentQuestion = async (): Promise<void> => {
    renderComponent?.unload()
    renderComponent = null
    container.empty()

    if (isFinished(state)) {
      const { total } = progress(state)
      container.createEl('p', { text: `${total}問解きました。` })
      const backBtn = container.createEl('button', { text: '一覧に戻る', cls: 'kokushi-btn' })
      backBtn.addEventListener('click', () => onExit())
      scrollToTop()
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

    const buttonHost = questionEl.createDiv()
    const nextHost = questionEl.createDiv()

    const frontmatter = plugin.app.metadataCache.getCache(meta.path)?.frontmatter
    renderAnswerButtons(plugin, id!, buttonHost, {
      choices: parseChoiceNumbers(raw),
      answer: readAnswer(frontmatter?.answer),
      choiceRoot: questionEl,
      onAnswered: () => {
        revealExplanation(plugin.app, questionEl, meta.path)
        // 「次へ」は判定結果のすぐ下（解説より上）に置く。
        // answerBlock が用意した置き場所を使う。見つからないときだけ従来の位置に置く。
        const host = (questionEl.querySelector(`.${NEXT_HOST_CLASS}`) as HTMLElement | null) ?? nextHost
        // 押し直しで onAnswered が複数回呼ばれても「次へ」が重複しないようにする
        if (questionEl.querySelector('.kokushi-next-btn') !== null) return
        const nextBtn = host.createEl('button', {
          text: '次へ',
          cls: 'kokushi-btn kokushi-btn-primary kokushi-next-btn',
        })
        nextBtn.addEventListener('click', () => {
          state = advance(state)
          void renderCurrentQuestion()
        })
      },
    })

    const abortBtn = questionEl.createEl('button', {
      text: '中断して一覧に戻る',
      cls: 'kokushi-btn kokushi-btn-quiet',
    })
    abortBtn.addEventListener('click', () => {
      renderComponent?.unload()
      renderComponent = null
      onExit()
    })
    scrollToTop()
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
