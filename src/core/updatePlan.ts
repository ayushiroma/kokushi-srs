export type DataEntryAction =
  | { kind: 'overwrite'; vaultPath: string }
  | { kind: 'knowledge-note'; vaultPath: string }
  | { kind: 'skip' }

const DATA_ROOT = '国試対策/データ'

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
  if (zipPath === '_config.json') {
    // _config.json は「データ」フォルダの外、Vaultルート直下にある
    // （src/obsidian/config.ts の CONFIG_PATH = '国試対策/_config.json' と同じ階層）
    return { kind: 'overwrite', vaultPath: '国試対策/_config.json' }
  }
  if (zipPath.startsWith('問題/')) {
    return { kind: 'overwrite', vaultPath: `${DATA_ROOT}/${zipPath}` }
  }
  return { kind: 'skip' } // 想定外のエントリは安全側に倒して無視する
}
