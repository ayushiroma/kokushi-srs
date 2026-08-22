import type { App } from 'obsidian'

/**
 * 解説calloutを開き、AI生成であることの注意書きを足す。
 *
 * 連続演習と、問題ノートを単体で開いたときの両方から呼ぶ。
 * sessionViewだけに置いていたため、単体表示では解説が自動で開かなかった
 * （2026-08-22の実機確認で判明）。
 *
 * host は解説calloutを含む要素。単体表示ではノート全体、連続演習では描画先。
 */
export function revealExplanation(app: App, host: HTMLElement, notePath: string): void {
  const box = host.querySelector('.callout[data-callout="解説"]')
  if (box === null) return

  if (box.classList.contains('is-collapsed')) {
    ;(box.querySelector('.callout-title') as HTMLElement | null)?.click()
  }

  // AI生成の解説であることを、読む場所に出す。使い方ノートの注意書きは読み飛ばされる。
  // 問題ファイル1,675件を書き換えず、描画時に足す。
  // 押し直しで複数回呼ばれても増えないようにする。
  const frontmatter = app.metadataCache.getCache(notePath)?.frontmatter
  if (frontmatter?.explanation_source !== 'ai') return
  if (box.querySelector('.kokushi-ai-note') !== null) return
  ;(box as HTMLElement).createEl('p', {
    text: '※AIが作成した解説です',
    cls: 'kokushi-ai-note',
  })
}
