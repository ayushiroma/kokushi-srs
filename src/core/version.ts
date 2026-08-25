const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/

function parseVersion(value: string): [number, number, number] | null {
  const match = VERSION_PATTERN.exec(value.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** latest が current より新しいバージョンかどうか。壊れた文字列は「新しくない」扱いにする */
export function isNewerVersion(current: string, latest: string): boolean {
  const c = parseVersion(current)
  const l = parseVersion(latest)
  if (!c || !l) return false
  for (let i = 0; i < 3; i++) {
    if (l[i] > c[i]) return true
    if (l[i] < c[i]) return false
  }
  return false
}

export function bumpVersion(version: string, part: 'patch' | 'minor' | 'major'): string {
  const parsed = parseVersion(version)
  if (!parsed) throw new Error(`不正なバージョン文字列です: ${version}`)
  const [major, minor, patch] = parsed
  if (part === 'major') return `${major + 1}.0.0`
  if (part === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}
