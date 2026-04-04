import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

const GOAL_TYPES = ["tip_amount", "new_subs", "viewer_count"] as const;

type GoalType = (typeof GOAL_TYPES)[number];

type GoalMetrics = Record<GoalType, number>;

type GoalRow = {
  id: string;
  stream_id: string;
  creator_id: string;
  type: GoalType;
  target: string | number;
  title: string;
  completed_at: string | null;
  stream_started_at: string;
  created_at: string;
  updated_at: string;
};

const listGoalQuerySchema = z.object({
  stream_id: z.string().uuid(),
});

const createGoalSchema = z.object({
  stream_id: z.string().uuid(),
  type: z.enum(GOAL_TYPES),
  target: z.number().positive(),
  title: z.string().trim().min(1).max(160),
});

async function ensureStreamGoalsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_stream_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('tip_amount', 'new_subs', 'viewer_count')),
      target NUMERIC(20, 7) NOT NULL CHECK (target > 0),
      title VARCHAR(160) NOT NULL,
      completed_at TIMESTAMPTZ,
      stream_started_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

async function getLiveGoalMetrics(
  creatorId: string,
  streamStartedAt: string
): Promise<GoalMetrics> {
  const [tipsResult, subsResult, viewersResult] = await Promise.all([
    sql<{ progress: string | null }>`
      SELECT COALESCE(SUM(amount_xlm), 0)::text AS progress
      FROM tip_transactions
      WHERE creator_id = ${creatorId}
        AND created_at >= ${streamStartedAt}
    `,
    sql<{ progress: number | null }>`
      SELECT COALESCE(COUNT(*)::int, 0) AS progress
      FROM subscriptions
      WHERE creator_id = ${creatorId}
        AND created_at >= ${streamStartedAt}
    `,
    sql<{ progress: number | null }>`
      SELECT COALESCE(current_viewers, 0)::int AS progress
      FROM users
      WHERE id = ${creatorId}
      LIMIT 1
    `,
  ]);

  return {
    tip_amount: Number(tipsResult.rows[0]?.progress ?? 0),
    new_subs: Number(subsResult.rows[0]?.progress ?? 0),
    viewer_count: Number(viewersResult.rows[0]?.progress ?? 0),
  };
}

async function markCompletedGoals(
  goals: GoalRow[],
  metrics: GoalMetrics
): Promise<void> {
  const completedGoalIds = goals
    .filter(
      goal => !goal.completed_at && metrics[goal.type] >= toNumber(goal.target)
    )
    .map(goal => goal.id);

  if (completedGoalIds.length === 0) {
    return;
  }

  await Promise.all(
    completedGoalIds.map(
      goalId => sql`
      UPDATE route_f_stream_goals
      SET completed_at = NOW(), updated_at = NOW()
      WHERE id = ${goalId}
        AND completed_at IS NULL
    `
    )
  );
}

function toGoalPayload(goal: GoalRow, metrics: GoalMetrics) {
  const target = toNumber(goal.target);
  const progress = metrics[goal.type] ?? 0;
  const completedAt =
    goal.completed_at ?? (progress >= target ? new Date().toISOString() : null);

  return {
    ...goal,
    target,
    progress,
    completed_at: completedAt,
    is_completed: Boolean(completedAt),
  };
}

async function resolveStreamStartForCreator(
  streamId: string,
  creatorId: string
): Promise<string> {
  try {
    const { rows } = await sql`
      SELECT started_at, user_id
      FROM stream_sessions
      WHERE id = ${streamId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return new Date().toISOString();
    }

    const stream = rows[0];
    if (String(stream.user_id) !== creatorId) {
      return "";
    }

    return stream.started_at
      ? new Date(stream.started_at).toISOString()
      : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    listGoalQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { stream_id } = queryResult.data;

  try {
    await ensureStreamGoalsSchema();

    const { rows } = await sql`
      SELECT
        id,
        stream_id,
        creator_id,
        type,
        target,
        title,
        completed_at,
        stream_started_at,
        created_at,
        updated_at
      FROM route_f_stream_goals
      WHERE stream_id = ${stream_id}
      ORDER BY created_at ASC
    `;

    if (rows.length === 0) {
      return NextResponse.json({ stream_id, goals: [] });
    }

    const goals = rows as GoalRow[];
    const metrics = await getLiveGoalMetrics(
      goals[0].creator_id,
      goals[0].stream_started_at
    );

    await markCompletedGoals(goals, metrics);
    const goalPayload = goals.map(goal => toGoalPayload(goal, metrics));

    return NextResponse.json({
      stream_id,
      goals: goalPayload,
      active_count: goalPayload.filter(goal => !goal.is_completed).length,
    });
  } catch (error) {
    console.error("[routes-f stream/goals GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch stream goals" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createGoalSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { stream_id, type, target, title } = bodyResult.data;

  try {
    await ensureStreamGoalsSchema();

    const { rows: ownerRows } = await sql`
      SELECT creator_id
      FROM route_f_stream_goals
      WHERE stream_id = ${stream_id}
      LIMIT 1
    `;

    if (
      ownerRows.length > 0 &&
      String(ownerRows[0].creator_id) !== session.userId
    ) {
      return NextResponse.json(
        { error: "Only the stream owner can manage goals" },
        { status: 403 }
      );
    }

    const { rows: activeRows } = await sql`
      SELECT COUNT(*)::int AS active_count
      FROM route_f_stream_goals
      WHERE stream_id = ${stream_id}
        AND creator_id = ${session.userId}
        AND completed_at IS NULL
    `;

    if (Number(activeRows[0]?.active_count ?? 0) >= 2) {
      return NextResponse.json(
        { error: "A stream can have at most 2 active goals" },
        { status: 409 }
      );
    }

    const streamStartedAt = await resolveStreamStartForCreator(
      stream_id,
      session.userId
    );

    if (!streamStartedAt) {
      return NextResponse.json(
        { error: "Only the stream owner can create goals for this stream" },
        { status: 403 }
      );
    }

    const { rows } = await sql`
      INSERT INTO route_f_stream_goals (
        stream_id,
        creator_id,
        type,
        target,
        title,
        stream_started_at
      )
      VALUES (
        ${stream_id},
        ${session.userId},
        ${type},
        ${target},
        ${title},
        ${streamStartedAt}
      )
      RETURNING
        id,
        stream_id,
        creator_id,
        type,
        target,
        title,
        completed_at,
        stream_started_at,
        created_at,
        updated_at
    `;

    const goal = rows[0] as GoalRow;
    const metrics = await getLiveGoalMetrics(
      goal.creator_id,
      goal.stream_started_at
    );

    if (!goal.completed_at && metrics[goal.type] >= toNumber(goal.target)) {
      await sql`
        UPDATE route_f_stream_goals
        SET completed_at = NOW(), updated_at = NOW()
        WHERE id = ${goal.id}
          AND completed_at IS NULL
      `;
      goal.completed_at = new Date().toISOString();
    }

    return NextResponse.json(toGoalPayload(goal, metrics), { status: 201 });
  } catch (error) {
    console.error("[routes-f stream/goals POST]", error);
    return NextResponse.json(
      { error: "Failed to create stream goal" },
      { status: 500 }
    );
  }
}
