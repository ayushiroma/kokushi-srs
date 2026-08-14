import { applyReview } from './srs'
import type { QuestionState, ReviewEntry } from './types'

export function buildStates(entries: ReviewEntry[]): Map<string, QuestionState> {
  const states = new Map<string, QuestionState>()
  for (const entry of entries) {
    states.set(entry.id, applyReview(states.get(entry.id) ?? null, entry))
  }
  return states
}
