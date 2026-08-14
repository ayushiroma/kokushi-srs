import type { App } from 'obsidian'

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

export async function loadConfig(app: App): Promise<KokushiConfig> {
  try {
    const adapter = app.vault.adapter
    if (!(await adapter.exists(CONFIG_PATH))) return DEFAULT_CONFIG
    const raw = JSON.parse(await adapter.read(CONFIG_PATH)) as Partial<KokushiConfig>
    return {
      examDates:
        raw.examDates && Object.keys(raw.examDates).length > 0
          ? raw.examDates
          : DEFAULT_CONFIG.examDates,
      scope: Array.isArray(raw.scope) ? raw.scope : DEFAULT_CONFIG.scope,
      years: typeof raw.years === 'number' ? raw.years : DEFAULT_CONFIG.years,
      showPacing: typeof raw.showPacing === 'boolean' ? raw.showPacing : DEFAULT_CONFIG.showPacing,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function earliestExamDate(config: KokushiConfig): string {
  const dates = Object.values(config.examDates).filter((d) => typeof d === 'string').sort()
  return dates[0] ?? DEFAULT_CONFIG.examDates.phn
}
