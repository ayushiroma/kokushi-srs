import { describe, expect, it } from 'vitest'
import { mergeLogs } from '../src/core/log'
import { CAPACITY_WINDOW_DAYS, MIN_STUDY_DAYS, masteredCountAsOf, masteryPerDay, measuredCapacity } from '../src/core/pace'
import type { ReviewEntry } from '../src/core/types'

function day(date: string, count: number, startId = 0): ReviewEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${startId + i}`,
    at: `${date}T10:00:00+09:00`,
    result: 'ok' as const,
  }))
}

describe('measuredCapacity', () => {
  it('解いた日が3日未満ならnull（計測期間中）', () => {
    const entries = [...day('2026-08-12', 10), ...day('2026-08-13', 10, 10)]
    expect(measuredCapacity(entries)).toBeNull()
  })

  it('解いた日が3日そろえば平均を返す', () => {
    const entries = [...day('2026-08-12', 10), ...day('2026-08-13', 20, 10), ...day('2026-08-14', 30, 30)]
    expect(measuredCapacity(entries)).toBe(20)
  })

  it('解かなかった日を分母に入れない', () => {
    const entries = [...day('2026-08-01', 30), ...day('2026-08-08', 30, 30), ...day('2026-08-14', 30, 60)]
    expect(measuredCapacity(entries)).toBe(30)
  })

  it('直近7日分の「解いた日」だけを使い、それより古い日は無視する', () => {
    const entries = [
      ...day('2026-08-01', 100),
      ...day('2026-08-02', 10, 100),
      ...day('2026-08-03', 10, 110),
      ...day('2026-08-04', 10, 120),
      ...day('2026-08-05', 10, 130),
      ...day('2026-08-06', 10, 140),
      ...day('2026-08-07', 10, 150),
      ...day('2026-08-08', 10, 160),
    ]
    expect(measuredCapacity(entries)).toBe(10)
  })

  it('平均が割り切れないときは四捨五入する', () => {
    // 31 / 3 = 10.33... → 10
    const down = [...day('2026-08-12', 10), ...day('2026-08-13', 10, 10), ...day('2026-08-14', 11, 20)]
    expect(measuredCapacity(down)).toBe(10)
    // 32 / 3 = 10.67... → 11
    const up = [...day('2026-08-12', 10), ...day('2026-08-13', 11, 100), ...day('2026-08-14', 11, 200)]
    expect(measuredCapacity(up)).toBe(11)
  })

  it('押し直しやメモで記録が増えても、解いた問題の数で数える', () => {
    // 毎日10問。うち3問は⭕△❌を押し直して記録が2件ずつになっている。
    // 件数で数えると13になり、ホームの「今日の分 10/13」が終わらなくなる。
    const withRedo = (date: string, startId: number): ReviewEntry[] => [
      ...day(date, 10, startId),
      ...day(date, 3, startId), // 同じ問題IDの2件目
    ]
    const entries = [
      ...withRedo('2026-08-12', 0),
      ...withRedo('2026-08-13', 10),
      ...withRedo('2026-08-14', 20),
    ]
    expect(measuredCapacity(entries)).toBe(10)
  })

  it('定数が設計どおり', () => {
    expect(MIN_STUDY_DAYS).toBe(3)
    expect(CAPACITY_WINDOW_DAYS).toBe(7)
  })
})

describe('masteredCountAsOf', () => {
  const exam = '2027-02-12'

  it('連続2回⭕で間隔が試験日を超えたら定着に数える', () => {
    const entries: ReviewEntry[] = [
      { id: 'a', at: '2026-11-01T10:00:00+09:00', result: 'ok' },
      { id: 'a', at: '2026-11-02T10:00:00+09:00', result: 'ok' },
      { id: 'a', at: '2026-11-05T10:00:00+09:00', result: 'ok' },
      { id: 'a', at: '2026-11-12T10:00:00+09:00', result: 'ok' },
      { id: 'a', at: '2026-11-26T10:00:00+09:00', result: 'ok' },
      { id: 'a', at: '2026-12-26T10:00:00+09:00', result: 'ok' },
    ]
    expect(masteredCountAsOf(entries, exam, '2026-12-26')).toBe(1)
  })

  it('指定日より後のログを無視する', () => {
    const entries: ReviewEntry[] = [
      { id: 'a', at: '2026-11-01T10:00:00+09:00', result: 'ok' },
      { id: 'a', at: '2026-12-26T10:00:00+09:00', result: 'ok' },
    ]
    expect(masteredCountAsOf(entries, exam, '2026-11-01')).toBe(0)
  })
})

describe('masteryPerDay', () => {
  const exam = '2027-02-12'

  /** 6回連続⭕で定着（次回が試験日より後）に到達する1問分のログ */
  function masteredChain(id: string): ReviewEntry[] {
    return [
      { id, at: '2026-11-01T10:00:00+09:00', result: 'ok' },
      { id, at: '2026-11-02T10:00:00+09:00', result: 'ok' },
      { id, at: '2026-11-05T10:00:00+09:00', result: 'ok' },
      { id, at: '2026-11-12T10:00:00+09:00', result: 'ok' },
      { id, at: '2026-11-26T10:00:00+09:00', result: 'ok' },
      { id, at: '2026-12-26T10:00:00+09:00', result: 'ok' },
    ]
  }

  it('期間内に定着が増えていなければnull', () => {
    const entries: ReviewEntry[] = [{ id: 'a', at: '2026-11-01T10:00:00+09:00', result: 'ok' }]
    expect(masteryPerDay(entries, exam, '2026-11-10')).toBeNull()
  })

  it('期間内に定着した数を日数で割った値を返す', () => {
    // 2026-12-12 時点では未定着（nextDue が 2026-12-26 で試験日より前）、
    // 2026-12-26 の⭕で nextDue が 2027-02-24 になり定着に到達する
    expect(masteryPerDay(masteredChain('a'), exam, '2026-12-26')).toBeCloseTo(1 / 14)
  })

  it('複数問が定着すればその分だけ増える', () => {
    const entries = mergeLogs([masteredChain('a'), masteredChain('b')])
    expect(masteryPerDay(entries, exam, '2026-12-26')).toBeCloseTo(2 / 14)
  })
})
