import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// DB schema (apply via migration):
//
// CREATE TABLE onboarding_progress (
//   user_id      UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
//   completed    TEXT[] DEFAULT '{}',
//   dismissed    BOOLEAN DEFAULT false,
//   completed_at TIMESTAMPTZ,
//   updated_at   TIMESTAMPTZ DEFAULT now()
// );
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

const STEPS = [
  { id: "set_avatar",      title: "Upload a profile photo" },
  { id: "set_bio",         title: "Write a bio" },
  { id: "set_stream_title",title: "Set a stream title" },
  { id: "add_category",    title: "Pick a stream category" },
  { id: "first_stream",    title: "Go live for the first time" },
  { id: "connect_wallet",  title: "Connect Stellar wallet" },
  { id: "first_follower",  title: "Get your first follower" },
  { id: "first_tip",       title: "Receive a tip" },
];

/**
 * Auto-detect which steps are complete by querying user data.
 */
async function detectCompletedSteps(userId: string): Promise<string[]> {
  const { rows } = await db.query(
    `SELECT
       u.avatar                                   AS avatar,
       u.bio                                      AS bio,
       u.wallet                                   AS wallet,
       c.stream_title                             AS stream_title,
       c.category                                 AS category,
       (SELECT COUNT(*) FROM streams WHERE creator_id = u.id)         AS total_streams,
       (SELECT COUNT(*) FROM follows  WHERE followed_id = u.id)       AS follower_count,
       (SELECT COUNT(*) FROM tips     WHERE recipient_id = u.id)      AS total_tips_count,
       op.completed                               AS manually_completed
     FROM users u
     LEFT JOIN creators c ON c.user_id = u.id
     LEFT JOIN onboarding_progress op ON op.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (rows.length === 0) return [];
  const row = rows[0];
  const manual: string[] = row.manually_completed ?? [];

  const auto: string[] = [];
  if (row.avatar)                        auto.push("set_avatar");
  if (row.bio)                           auto.push("set_bio");
  if (row.stream_title)                  auto.push("set_stream_title");
  if (row.category)                      auto.push("add_category");
  if (Number(row.total_streams) > 0)     auto.push("first_stream");
  if (row.wallet)                        auto.push("connect_wallet");
  if (Number(row.follower_count) >= 1)   auto.push("first_follower");
  if (Number(row.total_tips_count) >= 1) auto.push("first_tip");

  // Merge auto-detected with manually marked (deduplicate)
  return [...new Set([...auto, ...manual])];
}

/**
 * GET /api/routes-f/onboarding
 * Returns the checklist progress for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const completed = await detectCompletedSteps(user.id);

  // Fetch dismissed state
  const { rows: progressRows } = await db.query(
    `SELECT dismissed, completed_at FROM onboarding_progress WHERE user_id = $1`,
    [user.id]
  );
  const dismissed = progressRows[0]?.dismissed ?? false;
  const completed_count = completed.length;
  const total_count = STEPS.length;
  const percentage = Math.round((completed_count / total_count) * 100);

  const steps = STEPS.map((s) => ({
    id: s.id,
    title: s.title,
    completed: completed.includes(s.id),
  }));

  return NextResponse.json({
    steps,
    completed_count,
    total_count,
    percentage,
    dismissed,
  });
}
