export type DataEntryAction =
  | { kind: 'overwrite'; vaultPath: string }
  | { kind: 'knowledge-note'; vaultPath: string }
  | { kind: 'skip' }

const DATA_ROOT = '国試対策/中身'

/**
 * data.zip の中の1エントリ（例 "問題/看護師/.../nurse-115-am-001.md"）を
 * Vaultにどう書き込むか判定する。
 */
export function classifyDataEntry(zipPath: string): DataEntryAction {
  if (zipPath.endsWith('/')) return { kind: 'skip' } // フォルダのエントリ
  if (zipPath.startsWith('_記録/') || zipPath === '_記録') return { kind: 'skip' } // 念のための防御
  if (zipPath.startsWith('知識ノート/') && zipPath.endsWith('.md')) {
    return { kind: 'knowledge-note', vaultPath: `${DATA_ROOT}/${zipPath}` }
  }
  if (zipPath.startsWith('問題/') || zipPath === '_config.json') {
    return { kind: 'overwrite', vaultPath: `${DATA_ROOT}/${zipPath}` }
  }
  return { kind: 'skip' } // 想定外のエントリは安全側に倒して無視する
}
