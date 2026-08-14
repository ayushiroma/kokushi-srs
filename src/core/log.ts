import type { ReviewEntry, Result } from './types'

const RESULTS: readonly string[] = ['ok', 'vague', 'wrong']

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
    if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) continue
    if (typeof o.result !== 'string' || !RESULTS.includes(o.result)) continue
    const entry: ReviewEntry = { id: o.id, at: o.at, result: o.result as Result }
    if (typeof o.reason === 'string' && o.reason !== '') entry.reason = o.reason
    out.push(entry)
  }
  return out
}

export function mergeLogs(logs: ReviewEntry[][]): ReviewEntry[] {
  return logs.flat().sort((a, b) => a.at.localeCompare(b.at))
}
