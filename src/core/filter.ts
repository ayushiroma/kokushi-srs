export interface Filter {
  field?: string
  exam?: string
  round?: number
  session?: string
  status?: string
  tag?: string
  limit: number
}

export function parseFilter(source: string): Filter {
  const filter: Filter = { limit: 50 }
  for (const line of source.split('\n')) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (value === '') continue
    if (key === 'field') filter.field = value
    else if (key === 'exam') filter.exam = value
    else if (key === 'session') filter.session = value
    else if (key === 'status') filter.status = value
    else if (key === 'tag') filter.tag = value
    else if (key === 'round') {
      const n = Number(value)
      if (!Number.isNaN(n)) filter.round = n
    } else if (key === 'limit') {
      const n = Number(value)
      if (!Number.isNaN(n) && n > 0) filter.limit = n
    }
  }
  return filter
}
