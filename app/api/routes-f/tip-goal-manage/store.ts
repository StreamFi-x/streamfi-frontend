import { TipGoal } from "./types";

// In-memory store: creator_id -> TipGoal
export const goalStore = new Map<string, TipGoal>();

/** Generates a simple deterministic-ish ID for practice use */
export function generateId(): string {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Reset store — used in tests */
export function _resetStore() {
  goalStore.clear();
}
