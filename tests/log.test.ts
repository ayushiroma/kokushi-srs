import { describe, expect, it } from 'vitest'
import { formatEntry, mergeLogs, parseLog } from '../src/core/log'

describe('formatEntry', () => {
  it('1行のJSONにする', () => {
    const line = formatEntry({ id: 'nurse-115-am-023', at: '2026-08-14T21:03:11+09:00', result: 'wrong', reason: '前負荷と後負荷を逆に覚えていた' })
    expect(line).not.toContain('\n')
    expect(JSON.parse(line).id).toBe('nurse-115-am-023')
  })
})

describe('parseLog', () => {
  it('複数行を読む', () => {
    const text = [
      '{"id":"a","at":"2026-08-14T10:00:00+09:00","result":"ok"}',
      '{"id":"b","at":"2026-08-14T10:01:00+09:00","result":"wrong","reason":"混同"}',
    ].join('\n')
    const got = parseLog(text)
    expect(got).toHaveLength(2)
    expect(got[1].reason).toBe('混同')
  })

  it('空行を無視する', () => {
    const text = '\n{"id":"a","at":"2026-08-14T10:00:00+09:00","result":"ok"}\n\n'
    expect(parseLog(text)).toHaveLength(1)
  })

  it('壊れた行を読み飛ばして残りを返す', () => {
    const text = [
      '{"id":"a","at":"2026-08-14T10:00:00+09:00","result":"ok"}',
      '{"id":"b","at":"2026-08-1',
      '{"id":"c","at":"2026-08-14T10:02:00+09:00","result":"vague"}',
    ].join('\n')
    const got = parseLog(text)
    expect(got.map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('resultが不正な行を捨てる', () => {
    const text = '{"id":"a","at":"2026-08-14T10:00:00+09:00","result":"perfect"}'
    expect(parseLog(text)).toHaveLength(0)
  })

  it('idが無い行を捨てる', () => {
    const text = '{"at":"2026-08-14T10:00:00+09:00","result":"ok"}'
    expect(parseLog(text)).toHaveLength(0)
  })

  it('空文字列なら空配列', () => {
    expect(parseLog('')).toEqual([])
  })
})

describe('mergeLogs', () => {
  it('複数端末のログを時刻順に並べる', () => {
    const pc = parseLog('{"id":"a","at":"2026-08-14T10:00:00+09:00","result":"ok"}')
    const mobile = parseLog('{"id":"b","at":"2026-08-14T09:00:00+09:00","result":"wrong"}')
    expect(mergeLogs([pc, mobile]).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('空の配列を渡しても壊れない', () => {
    expect(mergeLogs([])).toEqual([])
  })
})
