import { requestUrl } from 'obsidian'
import { isNewerVersion } from '../core/version'

const RELEASES_LATEST_URL = 'https://api.github.com/repos/ayushiroma/kokushi-srs/releases/latest'

export interface UpdateAsset {
  name: string
  url: string
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  assets: UpdateAsset[]
}

function isAssetLike(value: unknown): value is { name: string; browser_download_url: string } {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.name === 'string' && typeof record.browser_download_url === 'string'
}

/**
 * 最新リリースを確認する。ネットワークエラーや想定外のレスポンスは
 * 静かに失敗させる（友達を止めないため）。`plugin.updateChecked` フラグが
 * Obsidianを再起動するまでtrueのままなので、再試行はObsidianを再起動するまで行われない。
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const response = await requestUrl({ url: RELEASES_LATEST_URL, throw: false })
    if (response.status !== 200) return null
    const body = response.json as { tag_name?: unknown; assets?: unknown }
    if (typeof body.tag_name !== 'string' || !Array.isArray(body.assets)) return null
    if (!isNewerVersion(currentVersion, body.tag_name)) return null
    const assets = body.assets.filter(isAssetLike).map((a) => ({ name: a.name, url: a.browser_download_url }))
    return { currentVersion, latestVersion: body.tag_name, assets }
  } catch (error) {
    console.error('kokushi-srs: 更新の確認に失敗しました', error)
    return null
  }
}
