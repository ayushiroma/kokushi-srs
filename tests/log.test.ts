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

  it('存在しない日付の行を捨てる', () => {
    const text = '{"id":"a","at":"2026-02-30T10:00:00+09:00","result":"ok"}'
    expect(parseLog(text)).toHaveLength(0)
  })

  it('ISO8601でない日時形式の行を捨てる', () => {
    for (const at of ['2026/08/14', 'Aug 14 2026', '2026-08-14', '2026-08-14T10:00:00']) {
      const text = `{"id":"a","at":"${at}","result":"ok"}`
      expect(parseLog(text), at).toHaveLength(0)
    }
  })

  it('Z表記と時差表記のどちらも受け入れる', () => {
    const text = [
      '{"id":"a","at":"2026-08-14T01:00:00.000Z","result":"ok"}',
      '{"id":"b","at":"2026-08-14T10:00:00+09:00","result":"ok"}',
    ].join('\n')
    expect(parseLog(text)).toHaveLength(2)
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

  it('Z表記と時差表記が混在しても実時刻の順に並ぶ', () => {
    // 01:00Z は 10:00+09:00 と同じ瞬間。09:30+09:00 (=00:30Z) のほうが先。
    const pc = parseLog('{"id":"later","at":"2026-08-14T01:00:00.000Z","result":"ok"}')
    const mobile = parseLog('{"id":"earlier","at":"2026-08-14T09:30:00+09:00","result":"ok"}')
    expect(mergeLogs([pc, mobile]).map((e) => e.id)).toEqual(['earlier', 'later'])
  })

  it('同時刻なら元の並び順を保つ', () => {
    const first = parseLog('{"id":"first","at":"2026-08-14T10:00:00+09:00","result":"ok"}')
    const second = parseLog('{"id":"second","at":"2026-08-14T10:00:00+09:00","result":"ok"}')
    expect(mergeLogs([first, second]).map((e) => e.id)).toEqual(['first', 'second'])
  })

  it('同一内容のログを1件に落とす（同期の競合コピー対策）', () => {
    const line = '{"id":"a","at":"2026-08-14T10:00:00+09:00","result":"ok"}'
    const original = parseLog(line)
    const duplicate = parseLog(line)
    expect(mergeLogs([original, duplicate])).toHaveLength(1)
  })

  it('同じ問題でも時刻が違えば別件として残す', () => {
    const first = parseLog('{"id":"a","at":"2026-08-14T10:00:00+09:00","result":"ok"}')
    const second = parseLog('{"id":"a","at":"2026-08-14T10:00:01+09:00","result":"ok"}')
    expect(mergeLogs([first, second])).toHaveLength(2)
  })
})

describe('chosen（選んだ選択肢番号）', () => {
  it('chosen を読み取る', () => {
    const line = JSON.stringify({ id: 'q1', at: '2026-08-22T10:00:00Z', result: 'wrong', chosen: [3] })
    expect(parseLog(line)[0].chosen).toEqual([3])
  })

  it('複数選んだ場合も読み取る', () => {
    const line = JSON.stringify({ id: 'q1', at: '2026-08-22T10:00:00Z', result: 'ok', chosen: [4, 5] })
    expect(parseLog(line)[0].chosen).toEqual([4, 5])
  })

  it('chosen が無い既存のログもそのまま読める', () => {
    const line = JSON.stringify({ id: 'q1', at: '2026-08-22T10:00:00Z', result: 'ok' })
    const entries = parseLog(line)
    expect(entries).toHaveLength(1)
    expect(entries[0].chosen).toBeUndefined()
  })

  it('chosen が壊れていても記録自体は捨てない', () => {
    const line = JSON.stringify({ id: 'q1', at: '2026-08-22T10:00:00Z', result: 'ok', chosen: 'あ' })
    const entries = parseLog(line)
    expect(entries).toHaveLength(1)
    expect(entries[0].chosen).toBeUndefined()
  })

  it('chosen を書き出せる', () => {
    const text = formatEntry({ id: 'q1', at: '2026-08-22T10:00:00Z', result: 'wrong', chosen: [2] })
    expect(JSON.parse(text).chosen).toEqual([2])
  })
})
