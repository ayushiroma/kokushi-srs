import { isHisshu, scoreHisshu, type HisshuRanges, type HisshuScore } from './hisshu'
import type { Result } from './types'

/**
 * 「絞り込んで解く」の選択状態から、本番モード（本番形式の通し演習として
 * 採点結果を出す）にするかを判定する。
 *
 * 試験と年度だけが選ばれていて、他の絞り込み（分野・種別・状態）が
 * 一切無いときだけ true。年度以外の絞り込みでは「必修8割」という基準
 * 自体が意味を持たない組み合わせが作れてしまうため、対象を年度別に限定する。
 */
export function isExamModeSelection(selection: {
  exam: string
  field: string
  type: string
  status: string
  round: string
}): boolean {
  return (
    selection.exam !== '' &&
    selection.round !== '' &&
    selection.field === '' &&
    selection.type === '' &&
    selection.status === ''
  )
}

export interface ExamAnswer {
  id: string
  result: Result
}

export interface ExamQuestionInfo {
  id: string
  exam: string
  session: string
  number: number
}

export interface ExamScoreBucket {
  attempted: number
  correct: number
  /** 解いたうち⭕の割合。1問も解いていなければ null */
  rate: number | null
}

export interface ExamScore {
  /** 必修の区分がある試験のときだけ値を持つ。区分が無い試験（保健師）では null */
  hisshu: HisshuScore | null
  /** 必修以外（区分が無い試験ではすべての問題）の得点 */
  general: ExamScoreBucket
  /** 必修＋一般をあわせた総合得点 */
  total: ExamScoreBucket
}

function summarize(results: readonly Result[]): ExamScoreBucket {
  const attempted = results.length
  const correct = results.filter((r) => r === 'ok').length
  return { attempted, correct, rate: attempted === 0 ? null : correct / attempted }
}

/**
 * 本番モードのセッションで記録した回答を、必修/一般に振り分けて集計する。
 * △（vague）は本番で落とす可能性が高いため、8割の絶対評価では正解に数えない
 * （`scoreHisshu` と同じ基準を一般側の集計にもそろえている）。
 */
export function scoreExam(
  answers: readonly ExamAnswer[],
  questions: readonly ExamQuestionInfo[],
  ranges: HisshuRanges
): ExamScore {
  const byId = new Map(questions.map((q) => [q.id, q]))

  const hisshuResults: Result[] = []
  const generalResults: Result[] = []
  let hasHisshuRange = false

  for (const answer of answers) {
    const question = byId.get(answer.id)
    if (!question) continue // 一覧に無い回答（データ不整合）は無視する
    if (ranges[question.exam] !== undefined) {
      hasHisshuRange = true
      if (isHisshu(question, ranges)) {
        hisshuResults.push(answer.result)
        continue
      }
    }
    generalResults.push(answer.result)
  }

  return {
    hisshu: hasHisshuRange ? scoreHisshu(hisshuResults) : null,
    general: summarize(generalResults),
    total: summarize([...hisshuResults, ...generalResults]),
  }
}
