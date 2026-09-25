import type { TipGoalHistoryEntry } from "./types";

// Most recently ended goal first.
export function sortByEndedAtDesc(
  goals: TipGoalHistoryEntry[]
): TipGoalHistoryEntry[] {
  return [...goals].sort(
    (a, b) => new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime()
  );
}
