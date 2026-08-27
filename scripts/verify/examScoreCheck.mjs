// 本番形式の通し演習の採点ロジックを、実データ（テスト用Vault）で検証するスクリプト。
// Obsidian非依存の scoreExam / isHisshu を、テスト用Vaultの看護師115回・保健師111回の
// 実際のfrontmatterに対して走らせ、必修/一般の内訳が期待どおりか目視確認する。
//
// 使い方: node scripts/verify/examScoreCheck.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const VAULT = 'C:\\Users\\shiro\\dev\\kokushi-srs-test-vault'
const QUESTIONS_DIR = join(VAULT, '国試対策', 'データ', '問題')

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!m) return null
  const fm = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*?)\r?$/)
    if (!kv) continue
    const [, key, val] = kv
    if (key === 'exam' || key === 'session' || key === 'id' || key === 'field') {
      fm[key] = val.trim()
    } else if (key === 'round' || key === 'number') {
      fm[key] = Number(val.trim())
    }
  }
  return fm
}

function loadQuestions(exam, round) {
  const files = walk(QUESTIONS_DIR)
  const out = []
  let parsed = 0
  for (const f of files) {
    const raw = readFileSync(f, 'utf8')
    const fm = parseFrontmatter(raw)
    if (fm) parsed++
    if (!fm || fm.exam !== exam || fm.round !== round) continue
    out.push({ id: fm.id, exam: fm.exam, session: fm.session, number: fm.number })
  }
  console.log(`  (debug) files=${files.length} parsed=${parsed} matched(${exam},${round})=${out.length}`)
  if (files.length > 0 && parsed === 0) {
    console.log('  (debug) sample fm:', JSON.stringify(parseFrontmatter(readFileSync(files[0], 'utf8'))))
  }
  return out
}

// --- core/hisshu.ts / core/examScore.ts と同じロジックをそのまま貼り付け（Obsidian非依存） ---
const DEFAULT_HISSHU = { nurse: { am: [1, 25], pm: [1, 25] } }

function isHisshu(q, ranges) {
  const range = ranges[q.exam]?.[q.session]
  if (range === undefined) return false
  return q.number >= range[0] && q.number <= range[1]
}

function scoreHisshu(results) {
  const attempted = results.length
  const correct = results.filter((r) => r === 'ok').length
  if (attempted === 0) return { attempted: 0, correct: 0, rate: null, passing: null }
  const rate = correct / attempted
  return { attempted, correct, rate, passing: rate >= 0.8 }
}

function summarize(results) {
  const attempted = results.length
  const correct = results.filter((r) => r === 'ok').length
  return { attempted, correct, rate: attempted === 0 ? null : correct / attempted }
}

function scoreExam(answers, questions, ranges) {
  const byId = new Map(questions.map((q) => [q.id, q]))
  const hisshuResults = []
  const generalResults = []
  let hasHisshuRange = false
  for (const answer of answers) {
    const question = byId.get(answer.id)
    if (!question) continue
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

// --- 検証本体 ---
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomResult(rng) {
  const r = rng()
  if (r < 0.6) return 'ok'
  if (r < 0.8) return 'vague'
  return 'wrong'
}

function printCase(label, exam, round, ranges) {
  const questions = loadQuestions(exam, round)
  if (questions.length === 0) {
    console.log(`[${label}] 問題が0件でした（Vaultのパス・回を確認）`)
    return
  }
  const rng = mulberry32(round)
  const answers = questions.map((q) => ({ id: q.id, result: randomResult(rng) }))
  const score = scoreExam(answers, questions, ranges)

  console.log(`\n=== ${label}（${exam} 第${round}回、実データ${questions.length}問） ===`)
  if (score.hisshu !== null) {
    console.log(
      `必修　${score.hisshu.correct}/${score.hisshu.attempted}問（${Math.round((score.hisshu.rate ?? 0) * 100)}%）passing=${score.hisshu.passing}`
    )
    console.log(
      `一般　${score.general.correct}/${score.general.attempted}問（${Math.round((score.general.rate ?? 0) * 100)}%）`
    )
    const expectedHisshu = questions.filter((q) => isHisshu(q, ranges)).length
    console.log(`  （必修の母数は問題番号ベースで期待値 ${expectedHisshu}問。実測 ${score.hisshu.attempted}問）`)
  } else {
    console.log(
      `得点　${score.total.correct}/${score.total.attempted}問（${Math.round((score.total.rate ?? 0) * 100)}%）※必修区分なし`
    )
  }
}

printCase('看護師（必修あり）', 'nurse', 115, DEFAULT_HISSHU)
printCase('保健師（必修なし）', 'phn', 111, DEFAULT_HISSHU)

// 中断・分野絞り込み時は本番モードにならないことのロジック確認（examScore.tsのisExamModeSelectionと同一）
function isExamModeSelection(selection) {
  return (
    selection.exam !== '' &&
    selection.round !== '' &&
    selection.field === '' &&
    selection.type === '' &&
    selection.status === ''
  )
}
console.log('\n=== 本番モード判定 ===')
console.log('試験+年度のみ:', isExamModeSelection({ exam: 'nurse', field: '', type: '', status: '', round: '115' }))
console.log('分野も選択:', isExamModeSelection({ exam: 'nurse', field: '循環器', type: '', status: '', round: '115' }))
