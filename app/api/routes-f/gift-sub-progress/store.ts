import type { GiftSubProgress } from "./types";

export const MILESTONES = [5, 10, 25, 50, 100] as const;

// stream_id -> total gift subs received during stream
export const giftCounts = new Map<string, number>([
  ["stream-gs-1", 7],
  ["stream-gs-2", 0],
  ["stream-gs-3", 100],
]);

export function computeProgress(count: number): GiftSubProgress {
  let current_milestone: number | null = null;
  let next_milestone: number | null = null;

  for (const m of MILESTONES) {
    if (count >= m) {
      current_milestone = m;
    } else {
      next_milestone = m;
      break;
    }
  }

  const prev = current_milestone ?? 0;
  const next = next_milestone;
  const percent_to_next =
    next === null
      ? 100
      : Math.min(100, Math.round(((count - prev) / (next - prev)) * 10000) / 100);

  return { gifts_received: count, current_milestone, next_milestone, percent_to_next };
}
