import { TFile } from 'obsidian'
import { buildKnowledgeMap, countUniqueNotes, filterToExisting } from '../core/knowledgeMap'
import { openInPreview } from './openInPreview'
import { indexQuestions } from './questionIndex'
import { RENDER_ERROR } from './messages'
import type KokushiPlugin from '../main'

function appendLinks(parent: HTMLElement, names: string[], plugin: KokushiPlugin): void {
  names.forEach((name, i) => {
    if (i > 0) parent.createSpan({ text: '・' })
    const link = parent.createEl('a', { text: name, href: '#' })
    link.onclick = (ev) => {
      ev.preventDefault()
      void openInPreview(plugin.app, name)
    }
  })
}

export function registerKnowledgeMapBlock(plugin: KokushiPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('kokushi-map', (_source, el) => {
    try {
      el.empty()
      const questions = indexQuestions(plugin.app)

      // 本体があるノートだけを残す。名前で引けるかどうかで判定しているので、
      // 知識ノートフォルダを別の場所へ移してもここを直す必要がない。
      const map = filterToExisting(
        buildKnowledgeMap(questions),
        (name) => plugin.app.metadataCache.getFirstLinkpathDest(name, '') instanceof TFile
      )

      if (map.length === 0) {
        el.createEl('p', { text: 'まだ知識ノートに繋がっている問題がありません' })
        return
      }

      el.createEl('p', {
        text: `知識ノート ${countUniqueNotes(map)} 件`,
        cls: 'kokushi-section-title',
      })
      el.createEl('p', {
        text: 'ⓘ 分野を押すと開きます。名前が分かっているノートは Ctrl+O で探すほうが早いです',
        cls: 'kokushi-hint',
      })

      for (const exam of map) {
        el.createEl('p', { text: exam.label, cls: 'kokushi-section-title' })
        for (const group of exam.groups) {
          // 分野は畳んでおく。開きっぱなしだと1行に最大168件のリンクが並び、
          // 37分野ぶんの文字の壁になって索引として読めなかった（2026-08-23の実測）。
          const box = el.createEl('details', { cls: 'kokushi-map-field' })
          box.createEl('summary', { text: `${group.field}（${group.notes.length}）` })
          appendLinks(box.createDiv({ cls: 'kokushi-map-row' }), group.notes, plugin)
        }
      }
    } catch (error) {
      el.empty()
      el.createEl('p', { text: RENDER_ERROR })
      console.error('kokushi-srs: 知識マップの表示に失敗しました', error)
    }
  })
}
