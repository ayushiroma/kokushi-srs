/** 全角数字を半角に直す。日本語入力のまま数字を打っても効くようにするため。 */
function toHalfWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

/**
 * `キー: 数値` の形式で書かれた整数を1つ取り出す。半角・全角のコロンと数字の両方に対応する。
 * 見つからない・数値でない・0以下なら fallback を返す。
 */
export function parseIntField(source: string, key: string, fallback: number): number {
  for (const line of source.split('\n')) {
    const idx = line.search(/[:：]/)
    if (idx < 0) continue
    if (line.slice(0, idx).trim() !== key) continue
    const value = Number(toHalfWidthDigits(line.slice(idx + 1).trim()))
    if (!Number.isNaN(value) && value > 0) return value
  }
  return fallback
}

export interface Filter {
  field?: string
  exam?: string
  round?: number
  session?: string
  status?: string
  tag?: string
  /** `必修` または `一般`。必修は8割が絶対条件なので、ここだけ集中して解けるようにする */
  type?: string
  limit: number
  /** 認識できなかったキー（打ち間違いを画面で知らせるため） */
  unknownKeys: string[]
}

export function parseFilter(source: string): Filter {
  const filter: Filter = { limit: 50, unknownKeys: [] }
  for (const line of source.split('\n')) {
    // 全角コロン「：」も受け付ける。この画面は日本語入力しながら手で書き換えるため、
    // 半角だけにすると「打ち間違えたのに何も起きない」という気づけない失敗になる。
    const idx = line.search(/[:：]/)
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (value === '') continue
    if (key === 'field') filter.field = value
    else if (key === 'exam') filter.exam = value
    else if (key === 'session') filter.session = value
    else if (key === 'status') filter.status = value
    else if (key === 'tag') filter.tag = value
    else if (key === 'type') filter.type = value
    else if (key === 'round') {
      const n = Number(toHalfWidthDigits(value))
      if (!Number.isNaN(n)) filter.round = n
    } else if (key === 'limit') {
      const n = Number(toHalfWidthDigits(value))
      if (!Number.isNaN(n) && n > 0) filter.limit = n
    } else {
      filter.unknownKeys.push(key)
    }
  }
  return filter
}
