/**
 * GET /api/routes-f/tip-goal-active?channel_id=<id>
 * 
 * Returns the active tip goal for a channel including target, raised, and deadline.
 * 
 * Query params:
 *   channel_id (required) - The channel ID to fetch the active tip goal for
 * 
 * Response 200:
 *   {
 *     goal_id: string,
 *     channel_id: string,
 *     target: number (USDC),
 *     raised: number (USDC),
 *     deadline: string (ISO 8601, optional),
 *     title?: string,
 *     percent_complete: number (0-100),
 *     is_completed: boolean,
 *   }
 * 
 * Response 200 (no active goal):
 *   { goal: null }
 * 
 * Error responses:
 *   400 — missing channel_id
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  channel_id: z.string().min(1, "channel_id is required"),
});

interface ActiveTipGoal {
  goal_id: string;
  channel_id: string;
  target: number;
  raised: number;
  deadline?: string;
  title?: string;
  percent_complete: number;
  is_completed: boolean;
}

/**
 * Get the active tip goal for a channel
 */
async function getActiveTipGoal(
  channel_id: string
): Promise<ActiveTipGoal | null> {
  try {
    // Query the database for active tip goal
    // Active = deadline not reached yet (or no deadline)
    const { rows } = await sql`
      SELECT 
        tg.id as goal_id,
        tg.channel_id,
        tg.target_usdc as target,
        COALESCE(SUM(t.amount_usdc), 0) as raised,
        tg.deadline,
        tg.title,
        tg.created_at,
        tg.updated_at
      FROM tip_goals tg
      LEFT JOIN tips t ON tg.id = t.goal_id AND t.status = 'completed'
      WHERE tg.channel_id = ${channel_id}
        AND (tg.deadline IS NULL OR tg.deadline > NOW())
        AND tg.deleted_at IS NULL
      GROUP BY tg.id, tg.channel_id, tg.target_usdc, tg.deadline, tg.title, tg.created_at, tg.updated_at
      ORDER BY tg.created_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const goal = rows[0] as any;
    const raised = parseFloat(goal.raised) || 0;
    const target = parseFloat(goal.target) || 1;
    const percentComplete = Math.min(100, Math.round((raised / target) * 10000) / 100);
    const isCompleted = raised >= target;

    return {
      goal_id: goal.goal_id,
      channel_id: goal.channel_id,
      target,
      raised,
      ...(goal.deadline ? { deadline: goal.deadline } : {}),
      ...(goal.title ? { title: goal.title } : {}),
      percent_complete: percentComplete,
      is_completed: isCompleted,
    };
  } catch (error) {
    console.error("[tip-goal-active] Error fetching active goal:", error);
    throw error;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Validate query parameters
  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { channel_id } = queryResult.data;

  try {
    const activeGoal = await getActiveTipGoal(channel_id);

    if (!activeGoal) {
      return NextResponse.json({ goal: null }, { status: 200 });
    }

    return NextResponse.json({ goal: activeGoal }, { status: 200 });
  } catch (error) {
    console.error("[tip-goal-active] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch active tip goal" },
      { status: 500 }
    );
  }
}
