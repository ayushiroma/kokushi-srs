/**
 * 必修問題の判定。
 *
 * 必修は50問中40問（8割）以上が絶対条件で、ここを落とすと他が満点でも不合格になる。
 * そのため「必修だけ解く」「必修の仕上がりを見る」を最優先で出せるようにする。
 *
 * **範囲は問題番号から導く。** 問題ノートに `必修` の印を持たせない。
 * 1,750問に埋め込んだ後で範囲が違うと分かると、全ファイルを直すことになるため。
 *
 * ⚠️ 厚労省の公開PDFには必修の範囲が明記されていない。既定値は
 * 「看護師 午前1〜25・午後1〜25」としてあるが、これは設定で変えられる。
 * 保健師国家試験には必修問題の区分そのものが無いため、既定では対象外。
 */

/** 試験ID → 時間帯 → [開始番号, 終了番号] */
export type HisshuRanges = Record<string, Record<string, readonly [number, number]>>

export const DEFAULT_HISSHU: HisshuRanges = {
  nurse: { am: [1, 25], pm: [1, 25] },
}

export interface HisshuTarget {
  exam: string
  session: string
  number: number
}

export function isHisshu(q: HisshuTarget, ranges: HisshuRanges): boolean {
  const range = ranges[q.exam]?.[q.session]
  if (range === undefined) return false
  return q.number >= range[0] && q.number <= range[1]
}

/** 必修の合格ライン（8割）。表示にも判定にも同じ値を使う */
export const HISSHU_PASS_RATE = 0.8

export interface HisshuScore {
  attempted: number
  correct: number
  /** 解いた必修問題のうち⭕の割合。1問も解いていなければ null */
  rate: number | null
  /** 8割に届いているか。解いていなければ null */
  passing: boolean | null
}

export function scoreHisshu(results: readonly ('ok' | 'vague' | 'wrong')[]): HisshuScore {
  const attempted = results.length
  // △（迷った）は本番で落とす可能性が高い。8割の絶対評価では正解に数えない
  const correct = results.filter((r) => r === 'ok').length
  if (attempted === 0) return { attempted: 0, correct: 0, rate: null, passing: null }
  const rate = correct / attempted
  return { attempted, correct, rate, passing: rate >= HISSHU_PASS_RATE }
}
