/** このシステムが持ち場にしているフォルダ */
export const KOKUSHI_ROOT = '国試対策'

/**
 * 国試対策の中のノートかどうか。
 *
 * 未作成リンクを無効化する処理は、ここに入っているノートだけに掛ける。
 * Vault全体に掛けてはいけない：daily note やメモでは「まだ無いノートへ
 * リンクを書いて、押して作る」がObsidianの便利な使い方であって、
 * それを奪うことになる。
 */
export function isKokushiNote(path: string): boolean {
  return path === `${KOKUSHI_ROOT}.md` || path.startsWith(`${KOKUSHI_ROOT}/`)
}
