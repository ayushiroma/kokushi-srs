import { requestUrl, type DataAdapter } from 'obsidian'
import { unzipSync } from 'fflate'
import { mergeKnowledgeNote } from '../core/memoMerge'
import { classifyDataEntry } from '../core/updatePlan'
import type { UpdateInfo } from './updateCheck'

export interface UpdateAssets {
  mainJs: ArrayBuffer
  manifestJson: ArrayBuffer
  stylesCss: ArrayBuffer
  dataZip: ArrayBuffer
}

function findAssetUrl(info: UpdateInfo, name: string): string {
  const asset = info.assets.find((a) => a.name === name)
  if (!asset) throw new Error(`リリースに ${name} が見つかりません`)
  return asset.url
}

export async function downloadUpdateAssets(info: UpdateInfo): Promise<UpdateAssets> {
  const [mainJs, manifestJson, stylesCss, dataZip] = await Promise.all(
    ['main.js', 'manifest.json', 'styles.css', 'data.zip'].map(async (name) => {
      const response = await requestUrl({ url: findAssetUrl(info, name) })
      return response.arrayBuffer
    })
  )
  return { mainJs, manifestJson, stylesCss, dataZip }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function ensureFolder(adapter: DataAdapter, folderPath: string, knownFolders: Set<string>): Promise<void> {
  const parts = folderPath.split('/')
  let current = ''
  for (const part of parts) {
    current = current === '' ? part : `${current}/${part}`
    if (knownFolders.has(current)) continue
    if (!(await adapter.exists(current))) {
      await adapter.mkdir(current)
    }
    knownFolders.add(current)
  }
}

function folderOf(vaultPath: string): string {
  return vaultPath.slice(0, vaultPath.lastIndexOf('/'))
}

/**
 * `classifyDataEntry` が計算した書き込み先が、Vaultの外へ抜け出そうとしていないか確認する。
 * data.zipはあゆさん自身のリリーススクリプトが生成する信頼できるものだが、
 * 万一 `../` のようなパストラバーサル文字列が混入していた場合に備えた軽い防御。
 */
function isSafeVaultPath(vaultPath: string): boolean {
  return !vaultPath.split(/[\\/]/).includes('..')
}

async function writeDataFile(
  adapter: DataAdapter,
  vaultPath: string,
  bytes: Uint8Array,
  knownFolders: Set<string>
): Promise<void> {
  await ensureFolder(adapter, folderOf(vaultPath), knownFolders)
  await adapter.writeBinary(vaultPath, toArrayBuffer(bytes))
}

async function writeKnowledgeNote(
  adapter: DataAdapter,
  vaultPath: string,
  bytes: Uint8Array,
  knownFolders: Set<string>
): Promise<void> {
  await ensureFolder(adapter, folderOf(vaultPath), knownFolders)
  const newContent = new TextDecoder().decode(bytes)
  const existingContent = (await adapter.exists(vaultPath)) ? await adapter.read(vaultPath) : null
  await adapter.write(vaultPath, mergeKnowledgeNote(newContent, existingContent))
}

/**
 * ダウンロードした更新をVaultへ書き込む。問題・知識ノート・_config.jsonは
 * `data.zip` を展開して先に書き込み、プラグイン本体（main.js等）は `pluginDir` へ
 * 最後に書き込む。データ書き込みの途中で失敗しても「古いプラグインコード＋
 * 新しいデータの一部」の状態に留まり、次回の再試行で直せるようにするため。
 * `_記録`（友達の解答ログ）はそもそも `data.zip` に含まれない前提で、
 * 万一含まれていても classifyDataEntry が弾く。
 */
export async function applyUpdate(adapter: DataAdapter, pluginDir: string, assets: UpdateAssets): Promise<void> {
  const knownFolders = new Set<string>()
  const entries = unzipSync(new Uint8Array(assets.dataZip))
  for (const [zipPath, bytes] of Object.entries(entries)) {
    const action = classifyDataEntry(zipPath)
    if (action.kind === 'skip') continue
    if (!isSafeVaultPath(action.vaultPath)) {
      console.error(`kokushi-srs: 不正な書き込み先のためスキップしました: ${action.vaultPath}`)
      continue
    }
    if (action.kind === 'overwrite') {
      await writeDataFile(adapter, action.vaultPath, bytes, knownFolders)
    } else {
      await writeKnowledgeNote(adapter, action.vaultPath, bytes, knownFolders)
    }
  }

  await adapter.writeBinary(`${pluginDir}/main.js`, assets.mainJs)
  await adapter.writeBinary(`${pluginDir}/manifest.json`, assets.manifestJson)
  await adapter.writeBinary(`${pluginDir}/styles.css`, assets.stylesCss)
}
