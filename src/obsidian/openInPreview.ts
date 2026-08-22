import { TFile, type App } from 'obsidian'

/**
 * ノートを必ず閲覧モードで開く。
 *
 * 編集モードで開くと、このプラグインのコードブロック（kokushi-list など）は
 * 生の文字列にしか見えない。利用者には「壊れている」としか映らないため、
 * プラグイン内から開くリンクは常にこの関数を通す。
 */
export async function openInPreview(app: App, linkpath: string): Promise<void> {
  const file = app.metadataCache.getFirstLinkpathDest(linkpath, '')
  if (!(file instanceof TFile)) {
    // 見つからないときは従来の動作にフォールバックする（開けないより開いたほうがよい）
    await app.workspace.openLinkText(linkpath, '', false)
    return
  }
  const leaf = app.workspace.getLeaf(false)
  await leaf.openFile(file, { state: { mode: 'preview' } })
}
