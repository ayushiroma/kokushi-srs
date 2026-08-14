/**
 * このシステムの「日付」はすべて日本時間（JST, UTC+9）で判定する。
 *
 * 国家試験は日本で行われ、利用者も日本にいる。実行環境のタイムゾーン設定によって
 * 「今日」がずれると、復習日が1日ずれる。OSの設定に結果を左右させない。
 * 日本には夏時間が無いため、固定オフセット +9時間 で厳密に正しい。
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** ある瞬間が、日本時間で何年何月何日かを返す */
export function toDateString(d: Date): string {
  const jst = new Date(d.getTime() + JST_OFFSET_MS)
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`
}

export function dateOf(iso: string): string {
  return toDateString(new Date(iso))
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}
