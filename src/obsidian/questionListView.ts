import { openInPreview } from './openInPreview'
import type { QuestionMeta } from './questionIndex'
import type KokushiPlugin from '../main'

export interface ListSection {
  /** 見出し。1つのまとまりしか無いときは null にして見出しを出さない */
  title: string | null
  metas: QuestionMeta[]
}

/**
 * 「◯◯を見る」で開け閉めできる問題リスト。
 *
 * 一覧を出しっぱなしにすると、50問・100問ぶんのリンクが縦に並び、
 * 肝心の中身が画面の外へ押し出される
 * （2026-08-23のあゆさんの指摘：「よく使う条件を選択する画面のはずなのに、
 * 問題が邪魔でめっちゃスクロールしないといけない」）。
 * 既定は閉じておき、押したときだけ開く。
 *
 * buttonHost にボタンを、listHost にリストを作る。ボタンは他のボタンと横に
 * 並べたいが、リストはその下の全幅に出したいので、置き場所を分けている。
 *
 * limit はまとまりごとに掛ける。
 */
export function renderToggleList(
  plugin: KokushiPlugin,
  buttonHost: HTMLElement,
  listHost: HTMLElement,
  sections: ListSection[],
  limit: number,
  label = '一覧'
): void {
  const button = buttonHost.createEl('button', { text: `${label}を見る`, cls: 'kokushi-btn' })
  let opened: HTMLElement | null = null

  const renderSection = (parent: HTMLElement, section: ListSection): void => {
    if (section.title !== null) {
      parent.createEl('p', {
        text: `【${section.title}】${section.metas.length}問`,
        cls: 'kokushi-section-title',
      })
    }
    if (section.metas.length === 0) {
      parent.createEl('p', { text: '　なし', cls: 'kokushi-hint' })
      return
    }
    const ul = parent.createEl('ul')
    for (const meta of section.metas.slice(0, limit)) {
      const li = ul.createEl('li')
      const link = li.createEl('a', { text: `${meta.id}　${meta.field}`, href: '#' })
      link.onclick = (ev) => {
        ev.preventDefault()
        void openInPreview(plugin.app, meta.path)
      }
    }
    // 何件か隠したことは黙らずに出す
    if (section.metas.length > limit) {
      ul.createEl('li', {
        text: `…ほか ${section.metas.length - limit}問（多いので${limit}問まで表示しています）`,
      })
    }
  }

  button.addEventListener('click', () => {
    if (opened !== null) {
      opened.remove()
      opened = null
      button.setText(`${label}を見る`)
      return
    }
    button.setText(`${label}を隠す`)
    const box = listHost.createDiv({ cls: 'kokushi-toggle-list' })
    opened = box
    for (const section of sections) renderSection(box, section)
  })
}
