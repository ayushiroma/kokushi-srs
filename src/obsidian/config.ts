import { Notice, type App } from 'obsidian'
import { DEFAULT_HISSHU, type HisshuRanges } from '../core/hisshu'

const CONFIG_PATH = '国試対策/_config.json'

export interface KokushiConfig {
  examDates: Record<string, string>
  scope: string[]
  years: number
  showPacing: boolean
  hisshu: HisshuRanges
  /** 学習ペースを実測できるまで使う1日の問題数。初日から解けるようにするため */
  defaultCapacity: number
}

export const DEFAULT_CONFIG: KokushiConfig = {
  examDates: { phn: '2027-02-12', nurse: '2027-02-14' },
  scope: ['nurse', 'phn'],
  years: 5,
  showPacing: true,
  hisshu: DEFAULT_HISSHU,
  defaultCapacity: 10,
}

/** YYYY-MM-DD の形式かどうか（ゼロ埋めしていない 2027-2-12 は文字列比較を壊すので弾く） */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidExamDates(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return false
  return entries.every(([, v]) => typeof v === 'string' && DATE_PATTERN.test(v))
}

/**
 * 必修の範囲が `{ nurse: { am: [1, 25] } }` の形になっているか確かめる。
 * 壊れた範囲を通すと必修が0件になったり全問が必修になったりして、
 * 「8割取れているか」の判定が黙って嘘をつく。
 */
function isValidHisshu(value: unknown): value is HisshuRanges {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every((sessions) => {
    if (typeof sessions !== 'object' || sessions === null || Array.isArray(sessions)) return false
    return Object.values(sessions as Record<string, unknown>).every(
      (range) =>
        Array.isArray(range) &&
        range.length === 2 &&
        range.every((n) => typeof n === 'number' && Number.isInteger(n) && n > 0) &&
        range[0] <= range[1],
    )
  })
}

export async function loadConfig(app: App): Promise<KokushiConfig> {
  try {
    const adapter = app.vault.adapter
    if (!(await adapter.exists(CONFIG_PATH))) return DEFAULT_CONFIG
    const raw = JSON.parse(await adapter.read(CONFIG_PATH)) as Partial<KokushiConfig>
    if (raw.examDates !== undefined && !isValidExamDates(raw.examDates)) {
      // 試験日が壊れていると全問が「定着」に化けて復習が止まる。無言で既定値に戻さず知らせる。
      new Notice('国試対策：_config.json の examDates が不正です。既定の試験日を使います')
      console.error('kokushi-srs: examDates が不正です', raw.examDates)
    }
    if (raw.hisshu !== undefined && !isValidHisshu(raw.hisshu)) {
      new Notice('国試対策：_config.json の hisshu が不正です。既定の必修範囲を使います')
      console.error('kokushi-srs: hisshu が不正です', raw.hisshu)
    }
    return {
      examDates: isValidExamDates(raw.examDates) ? raw.examDates : DEFAULT_CONFIG.examDates,
      scope: Array.isArray(raw.scope) ? raw.scope : DEFAULT_CONFIG.scope,
      years: typeof raw.years === 'number' ? raw.years : DEFAULT_CONFIG.years,
      showPacing: typeof raw.showPacing === 'boolean' ? raw.showPacing : DEFAULT_CONFIG.showPacing,
      hisshu: isValidHisshu(raw.hisshu) ? raw.hisshu : DEFAULT_CONFIG.hisshu,
      defaultCapacity:
        typeof raw.defaultCapacity === 'number' &&
        Number.isInteger(raw.defaultCapacity) &&
        raw.defaultCapacity > 0
          ? raw.defaultCapacity
          : DEFAULT_CONFIG.defaultCapacity,
    }
  } catch (error) {
    new Notice('国試対策：_config.json を読めませんでした。既定値を使います')
    console.error('kokushi-srs: _config.json を読めませんでした', error)
    return DEFAULT_CONFIG
  }
}

export function earliestExamDate(config: KokushiConfig): string {
  const dates = Object.values(config.examDates)
    .filter((d): d is string => typeof d === 'string' && DATE_PATTERN.test(d))
    .sort()
  return dates[0] ?? DEFAULT_CONFIG.examDates.phn
}
