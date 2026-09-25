import type { TipGoalHistoryEntry } from "./types";

// Deterministic seed history — final, resolved goals only (no in-progress ones).
export const tipGoalHistoryStore: TipGoalHistoryEntry[] = [
  {
    goal_id: "goal_alpha_1",
    creator_id: "creator-alpha",
    goal_usdc: 100,
    total_raised_usdc: 128,
    status: "reached",
    contributors: 14,
    started_at: "2026-04-01T00:00:00.000Z",
    ended_at: "2026-04-10T00:00:00.000Z",
  },
  {
    goal_id: "goal_alpha_2",
    creator_id: "creator-alpha",
    goal_usdc: 200,
    total_raised_usdc: 96,
    status: "expired",
    contributors: 9,
    started_at: "2026-05-01T00:00:00.000Z",
    ended_at: "2026-05-15T00:00:00.000Z",
  },
  {
    goal_id: "goal_alpha_3",
    creator_id: "creator-alpha",
    goal_usdc: 150,
    total_raised_usdc: 40,
    status: "cancelled",
    contributors: 5,
    started_at: "2026-06-01T00:00:00.000Z",
    ended_at: "2026-06-03T00:00:00.000Z",
  },
  {
    goal_id: "goal_beta_1",
    creator_id: "creator-beta",
    goal_usdc: 50,
    total_raised_usdc: 55,
    status: "reached",
    contributors: 3,
    started_at: "2026-03-01T00:00:00.000Z",
    ended_at: "2026-03-05T00:00:00.000Z",
  },
];

export function getGoalHistoryForCreator(
  creatorId: string
): TipGoalHistoryEntry[] {
  return tipGoalHistoryStore.filter(g => g.creator_id === creatorId);
}
