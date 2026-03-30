import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

const goalHistoryQuerySchema = z.object({
  type: z.enum(["sub_count", "tip_amount", "viewer_count"]).optional(),
  limit: z.coerce.number().min(1).max(20).default(20),
  cursor: z.string().uuid().optional(),
});

type HistoryGoalRow = {
  id: string;
  stream_id: string;
  type: "tip_amount" | "new_subs" | "viewer_count";
  target: string | number;
  title: string;
  completed_at: string | null;
  stream_started_at: string;
  created_at: string;
  ended_at: string | null;
  archive_sort_at: string;
  peak_viewers: number | null;
};

const API_TO_DB_TYPE: Record<string, string> = {
  sub_count: "new_subs",
  tip_amount: "tip_amount",
  viewer_count: "viewer_count",
};

function outputType(type: HistoryGoalRow["type"]) {
  return type === "new_subs" ? "sub_count" : type;
}

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function durationDays(startedAt: string, endedAt: string | null) {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt ?? new Date().toISOString()).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 1;
  }

  return Math.max(1, Math.ceil((endMs - startMs) / 86_400_000));
}

async function ensureGoalHistorySchema(): Promise<void> {
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

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_stream_goals_creator_created
    ON route_f_stream_goals (creator_id, created_at DESC)
  `;
}

async function getAchievedValue(goal: HistoryGoalRow, creatorId: string) {
  const effectiveEnd =
    goal.completed_at ?? goal.ended_at ?? new Date().toISOString();

  if (goal.type === "tip_amount") {
    const { rows } = await sql<{ achieved_value: string | null }>`
      SELECT COALESCE(SUM(amount_xlm), 0)::text AS achieved_value
      FROM tip_transactions
      WHERE creator_id = ${creatorId}
        AND created_at >= ${goal.stream_started_at}
        AND created_at <= ${effectiveEnd}
    `;

    return Number(rows[0]?.achieved_value ?? 0);
  }

  if (goal.type === "new_subs") {
    const { rows } = await sql<{ achieved_value: number | null }>`
      SELECT COUNT(*)::int AS achieved_value
      FROM subscriptions
      WHERE creator_id = ${creatorId}
        AND created_at >= ${goal.stream_started_at}
        AND created_at <= ${effectiveEnd}
    `;

    return Number(rows[0]?.achieved_value ?? 0);
  }

  return Number(goal.peak_viewers ?? 0);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    goalHistoryQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { type, cursor } = queryResult.data;
  const limit = queryResult.data.limit ?? 20;

  try {
    await ensureGoalHistorySchema();

    let cursorSortAt: string | null = null;
    if (cursor) {
      const { rows } = await sql<{ archive_sort_at: string }>`
        SELECT COALESCE(g.completed_at, ss.ended_at, g.created_at)::text AS archive_sort_at
        FROM route_f_stream_goals g
        LEFT JOIN stream_sessions ss ON ss.id = g.stream_id
        WHERE g.id = ${cursor}
          AND g.creator_id = ${session.userId}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      cursorSortAt = rows[0].archive_sort_at;
    }

    const dbType = type ? API_TO_DB_TYPE[type] : null;

    const { rows } = await sql<HistoryGoalRow>`
      SELECT
        g.id,
        g.stream_id,
        g.type,
        g.target,
        g.title,
        g.completed_at,
        g.stream_started_at,
        g.created_at,
        ss.ended_at,
        ss.peak_viewers,
        COALESCE(g.completed_at, ss.ended_at, g.created_at)::text AS archive_sort_at
      FROM route_f_stream_goals g
      LEFT JOIN stream_sessions ss ON ss.id = g.stream_id
      WHERE g.creator_id = ${session.userId}
        AND (${dbType}::text IS NULL OR g.type = ${dbType})
        AND (g.completed_at IS NOT NULL OR ss.ended_at IS NOT NULL)
        AND (
          ${cursorSortAt}::timestamptz IS NULL
          OR (
            COALESCE(g.completed_at, ss.ended_at, g.created_at) < ${cursorSortAt}
            OR (
              COALESCE(g.completed_at, ss.ended_at, g.created_at) = ${cursorSortAt}
              AND g.id < ${cursor ?? null}
            )
          )
        )
      ORDER BY COALESCE(g.completed_at, ss.ended_at, g.created_at) DESC, g.id DESC
      LIMIT ${limit + 1}
    `;

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? rows[limit].id : null;

    const records = await Promise.all(
      page.map(async goal => {
        const achievedValue = await getAchievedValue(goal, session.userId);
        const status = goal.completed_at ? "completed" : "expired";
        const endedAt = goal.completed_at ?? goal.ended_at;

        return {
          id: goal.id,
          stream_id: goal.stream_id,
          title: goal.title,
          type: outputType(goal.type),
          target: toNumber(goal.target),
          achieved_value: achievedValue,
          completed_at: goal.completed_at,
          duration_days: durationDays(goal.created_at, endedAt),
          status,
        };
      })
    );

    return NextResponse.json({
      records,
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error("[routes-f creator/goals/history GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch goal history" },
      { status: 500 }
    );
  }
}
