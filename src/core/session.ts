export interface SessionState {
  ids: string[]
  index: number
}

export function startSession(ids: string[]): SessionState {
  return { ids, index: 0 }
}

export function currentId(state: SessionState): string | null {
  return state.index < state.ids.length ? state.ids[state.index] : null
}

export function advance(state: SessionState): SessionState {
  return { ids: state.ids, index: Math.min(state.index + 1, state.ids.length) }
}

export function isFinished(state: SessionState): boolean {
  return state.index >= state.ids.length
}

export function progress(state: SessionState): { done: number; total: number } {
  return { done: Math.min(state.index, state.ids.length), total: state.ids.length }
}
