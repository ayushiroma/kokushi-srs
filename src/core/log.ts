import type { ReviewEntry, Result } from './types'

const RESULTS: readonly Result[] = ['ok', 'vague', 'wrong']

/** ISO 8601: YYYY-MM-DDTHH:MM:SS(.sss)?(Z|±HH:MM) */
const ISO8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

/**
 * 日時として信頼できるかを判定する。
 * Date.parse だけでは "2026-02-30"（存在しない日）が3月2日にロールオーバーして通り、
 * "2026/08/14" のような非ISO形式も通ってしまう。どちらも mergeLogs の時系列を壊す。
 */
function isValidTimestamp(at: string): boolean {
  if (!ISO8601.test(at)) return false
  const year = Number(at.slice(0, 4))
  const month = Number(at.slice(5, 7))
  const day = Number(at.slice(8, 10))
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return false
  }
  return !Number.isNaN(Date.parse(at))
}

export function formatEntry(e: ReviewEntry): string {
  return JSON.stringify(e)
}

export function parseLog(text: string): ReviewEntry[] {
  const out: ReviewEntry[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      continue
    }
    if (typeof parsed !== 'object' || parsed === null) continue
    const o = parsed as Record<string, unknown>
    if (typeof o.id !== 'string' || o.id === '') continue
    if (typeof o.at !== 'string' || !isValidTimestamp(o.at)) continue
    if (typeof o.result !== 'string' || !RESULTS.includes(o.result as Result)) continue
    const entry: ReviewEntry = { id: o.id, at: o.at, result: o.result as Result }
    if (typeof o.reason === 'string' && o.reason !== '') entry.reason = o.reason
    out.push(entry)
  }
  return out
}

/**
 * 複数端末のログを時系列に並べる。
 * 文字列の辞書順ではなく実時刻で比較する（"Z" と "+09:00" が混在すると辞書順は破綻するため）。
 * 同時刻は元の並び順を保つ（Task 5がこの順序どおりに状態を畳み込むため、順序がぶれると復習日が変わる）。
 */
export function mergeLogs(logs: ReviewEntry[][]): ReviewEntry[] {
  return logs
    .flat()
    .map((entry, index) => ({ entry, index, time: Date.parse(entry.at) }))
    .sort((a, b) => (a.time !== b.time ? a.time - b.time : a.index - b.index))
    .map((x) => x.entry)
}
