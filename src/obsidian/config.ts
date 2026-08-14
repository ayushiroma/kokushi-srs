import { Notice, type App } from 'obsidian'

const CONFIG_PATH = '国試対策/_config.json'

export interface KokushiConfig {
  examDates: Record<string, string>
  scope: string[]
  years: number
  showPacing: boolean
}

export const DEFAULT_CONFIG: KokushiConfig = {
  examDates: { phn: '2027-02-12', nurse: '2027-02-14' },
  scope: ['nurse', 'phn'],
  years: 5,
  showPacing: true,
}

/** YYYY-MM-DD の形式かどうか（ゼロ埋めしていない 2027-2-12 は文字列比較を壊すので弾く） */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidExamDates(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return false
  return entries.every(([, v]) => typeof v === 'string' && DATE_PATTERN.test(v))
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
    return {
      examDates: isValidExamDates(raw.examDates) ? raw.examDates : DEFAULT_CONFIG.examDates,
      scope: Array.isArray(raw.scope) ? raw.scope : DEFAULT_CONFIG.scope,
      years: typeof raw.years === 'number' ? raw.years : DEFAULT_CONFIG.years,
      showPacing: typeof raw.showPacing === 'boolean' ? raw.showPacing : DEFAULT_CONFIG.showPacing,
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
