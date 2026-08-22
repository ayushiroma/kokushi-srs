import type { Result } from './types'

/**
 * 行頭の `1. ` `1． ` を選択肢とみなす。
 *
 * 解説callout内の番号付き行は `> - 1. ` のように引用とリストの記号が前に付くため、
 * 行頭一致では拾われない。実データ1,675件で検証済み（2026-08-22）。
 */
const CHOICE_LINE = /^([1-5])[.．][ 　]/gm

/** 国試の選択肢は4つか5つ。それ以外は「選択肢ではない何か」を拾っている */
const MIN_CHOICES = 4

export function parseChoiceNumbers(body: string): number[] {
  const numbers: number[] = []
  for (const match of body.matchAll(CHOICE_LINE)) {
    numbers.push(Number(match[1]))
  }
  if (numbers.length < MIN_CHOICES) return []
  // 1から始まる連番でなければ、選択肢の取り違えとみなして諦める。
  // 中途半端に拾った番号でボタンを出すと、押せない選択肢が生まれて混乱するため。
  const expected = Array.from({ length: numbers.length }, (_, i) => i + 1)
  if (numbers.join(',') !== expected.join(',')) return []
  return numbers
}

export function judge(chosen: number[], answer: number[]): Result {
  if (chosen.length !== answer.length) return 'wrong'
  const sortedChosen = [...chosen].sort((a, b) => a - b)
  const sortedAnswer = [...answer].sort((a, b) => a - b)
  return sortedChosen.join(',') === sortedAnswer.join(',') ? 'ok' : 'wrong'
}
