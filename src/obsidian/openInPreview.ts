import { Notice, TFile, type App } from 'obsidian'

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
    // 見つからないときは何も作らない。
    // 以前は openLinkText にフォールバックしていたが、あれは**見つからないと
    // その名前のノートを新規作成する**。作成先は設定 `newFileLocation` 任せなので、
    // 既定のままだとVaultのルートに空ファイルが増えていく
    // （2026-08-23のあゆさんの報告：「全然違う場所にファイルが作成されて困ってる」）。
    // 開けないことより、黙って物が増えることのほうが困る。
    new Notice(`国試対策：「${linkpath}」が見つかりませんでした`)
    console.error('kokushi-srs: ノートが見つかりません', linkpath)
    return
  }
  const leaf = app.workspace.getLeaf(false)
  await leaf.openFile(file, { state: { mode: 'preview' } })
}
