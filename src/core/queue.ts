import type { QuestionState } from './types'

export interface Queue {
  due: string[]
  fresh: string[]
}

export interface QueueInput {
  allIds: string[]
  states: Map<string, QuestionState>
  today: string
  capacity: number | null
}

export function buildQueue({ allIds, states, today, capacity }: QueueInput): Queue {
  const due = allIds.filter((id) => {
    const s = states.get(id)
    return s !== undefined && s.nextDue <= today
  })
  if (capacity === null) return { due, fresh: [] }
  const room = Math.max(0, capacity - due.length)
  const fresh = allIds.filter((id) => !states.has(id)).slice(0, room)
  return { due, fresh }
}
