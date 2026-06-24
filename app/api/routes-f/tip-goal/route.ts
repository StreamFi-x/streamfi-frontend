/**
 * GET /api/routes-f/tip-goal?creator_id=<id>
 * Returns active tip goal progress for a creator, or null if no active goal.
 */
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TipRecord {
  viewer_id: string;
  amount_usdc: number;
  tipped_at: string;
}

export interface TipGoal {
  creator_id: string;
  goal_usdc: number;
  ends_at?: string; // ISO string; absent = no deadline
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
export const goals = new Map<string, TipGoal>([
  [
    "creator-alpha",
    { creator_id: "creator-alpha", goal_usdc: 100, ends_at: "2099-12-31T00:00:00.000Z" },
  ],
  [
    "creator-beta",
    { creator_id: "creator-beta", goal_usdc: 50 },
  ],
]);

export const tipRecords = new Map<string, TipRecord[]>([
  [
    "creator-alpha",
    [
      { viewer_id: "viewer-1", amount_usdc: 30, tipped_at: "2026-06-01T10:00:00.000Z" },
      { viewer_id: "viewer-2", amount_usdc: 25, tipped_at: "2026-06-02T11:00:00.000Z" },
      { viewer_id: "viewer-1", amount_usdc: 10, tipped_at: "2026-06-03T12:00:00.000Z" },
    ],
  ],
  [
    "creator-beta",
    [
      { viewer_id: "viewer-3", amount_usdc: 50, tipped_at: "2026-06-01T09:00:00.000Z" },
    ],
  ],
]);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
interface GoalProgressResponse {
  goal_usdc: number;
  current_usdc: number;
  percent: number;
  ends_at?: string;
  contributors: number;
}

function computeProgress(creator_id: string): GoalProgressResponse | null {
  const goal = goals.get(creator_id);
  if (!goal) return null;

  // Check expiry
  if (goal.ends_at && new Date(goal.ends_at) < new Date()) return null;

  const records = tipRecords.get(creator_id) ?? [];
  const current_usdc = records.reduce((sum, r) => sum + r.amount_usdc, 0);
  const uniqueViewers = new Set(records.map((r) => r.viewer_id));
  const percent = Math.min(
    100,
    Math.round((current_usdc / goal.goal_usdc) * 10000) / 100
  );

  return {
    goal_usdc: goal.goal_usdc,
    current_usdc,
    percent,
    ...(goal.ends_at ? { ends_at: goal.ends_at } : {}),
    contributors: uniqueViewers.size,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const creator_id = new URL(req.url).searchParams.get("creator_id");
  if (!creator_id) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const progress = computeProgress(creator_id);
  return NextResponse.json({ goal: progress });
}
