import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

const VALID_STEPS = [
  "set_avatar",
  "set_bio",
  "set_stream_title",
  "add_category",
  "first_stream",
  "connect_wallet",
  "first_follower",
  "first_tip",
];

/**
 * POST /api/routes-f/onboarding/complete
 * Mark a step as manually complete (for edge cases like wallet connection).
 * Also handles { dismiss: true } to hide the checklist.
 * When all 8 steps complete, awards the onboarding_complete badge.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { step_id, dismiss } = body;

  if (dismiss === true) {
    // Upsert and set dismissed = true
    await db.query(
      `INSERT INTO onboarding_progress (user_id, dismissed, updated_at)
       VALUES ($1, true, now())
       ON CONFLICT (user_id) DO UPDATE SET dismissed = true, updated_at = now()`,
      [user.id]
    );
    return NextResponse.json({ success: true, dismissed: true });
  }

  if (!step_id || !VALID_STEPS.includes(step_id)) {
    return NextResponse.json(
      { error: `Invalid step_id. Must be one of: ${VALID_STEPS.join(", ")}` },
      { status: 400 }
    );
  }

  // Upsert progress row and append step_id to completed array (idempotent)
  await db.query(
    `INSERT INTO onboarding_progress (user_id, completed, updated_at)
     VALUES ($1, ARRAY[$2::TEXT], now())
     ON CONFLICT (user_id) DO UPDATE
       SET completed   = array_append(
                           CASE WHEN $2 = ANY(onboarding_progress.completed)
                                THEN onboarding_progress.completed
                                ELSE onboarding_progress.completed
                           END, $2),
           updated_at  = now()`,
    [user.id, step_id]
  );

  // Check if all steps are now complete
  const { rows } = await db.query(
    `SELECT completed FROM onboarding_progress WHERE user_id = $1`,
    [user.id]
  );

  const completedSteps: string[] = rows[0]?.completed ?? [];
  const allDone = VALID_STEPS.every((s) => completedSteps.includes(s));

  if (allDone) {
    // Mark completed_at if not already set
    await db.query(
      `UPDATE onboarding_progress
       SET completed_at = COALESCE(completed_at, now())
       WHERE user_id = $1 AND completed_at IS NULL`,
      [user.id]
    );

    // Award onboarding_complete badge (fire-and-forget; badge API handles idempotency)
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/routes-f/badges/award`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, badge_slug: "onboarding_complete" }),
        }
      );
    } catch {
      // Non-critical: badge award failure should not block the response
    }
  }

  return NextResponse.json({
    success: true,
    step_id,
    all_complete: allDone,
  });
}
