import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { usernameSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import {
  MILESTONE_TYPES,
  type MilestoneType,
  ensureMilestonesSchema,
} from "./_lib/db";

const createMilestoneSchema = z.object({
  type: z.enum(MILESTONE_TYPES),
  target: z.number().positive(),
  title: z.string().trim().min(1).max(255),
  reward_description: z.string().trim().max(500).optional(),
});

const listMilestonesQuerySchema = z.object({
  creator: usernameSchema,
});

type CreatorMetrics = Record<MilestoneType, number>;

type MilestoneRow = {
  id: string;
  creator_id: string;
  type: MilestoneType;
  target: string | number;
  title: string;
  reward_description: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapTarget(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

async function getCreatorMetrics(username: string): Promise<{
  creatorId: string;
  creatorUsername: string;
  metrics: CreatorMetrics;
} | null> {
  const { rows } = await sql`
    SELECT
      u.id,
      u.username,
      COALESCE(u.total_tips_received, 0) AS total_tips_received,
      COALESCE(u.current_viewers, 0) AS current_viewers,
      (
        SELECT COUNT(*)::int
        FROM user_follows uf
        WHERE uf.followee_id = u.id
      ) AS follower_count
    FROM users u
    WHERE LOWER(u.username) = LOWER(${username})
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    creatorId: row.id,
    creatorUsername: row.username,
    metrics: {
      sub_count: Number(row.follower_count ?? 0),
      tip_amount: Number(row.total_tips_received ?? 0),
      viewer_count: Number(row.current_viewers ?? 0),
    },
  };
}

function withProgress(row: MilestoneRow, metrics: CreatorMetrics) {
  const progress = metrics[row.type] ?? 0;
  const target = mapTarget(row.target);

  return {
    ...row,
    target,
    progress,
    is_completed: Boolean(row.completed_at) || progress >= target,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, listMilestonesQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureMilestonesSchema();

    const creator = await getCreatorMetrics(queryResult.data.creator);
    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const { rows } = await sql`
      SELECT id, creator_id, type, target, title, reward_description, completed_at, created_at, updated_at
      FROM route_f_milestones
      WHERE creator_id = ${creator.creatorId}
      ORDER BY created_at DESC
    `;

    const milestones = rows.map(row =>
      withProgress(row as MilestoneRow, creator.metrics)
    );

    await Promise.all(
      milestones
        .filter(
          milestone =>
            !milestone.completed_at && milestone.progress >= milestone.target
        )
        .map(
          milestone =>
            sql`
            UPDATE route_f_milestones
            SET completed_at = now(), updated_at = now()
            WHERE id = ${milestone.id} AND completed_at IS NULL
          `
        )
    );

    const normalized = milestones.map(milestone => ({
      ...milestone,
      completed_at:
        milestone.completed_at ??
        (milestone.progress >= milestone.target
          ? new Date().toISOString()
          : null),
    }));

    return NextResponse.json({
      creator: creator.creatorUsername,
      metrics: creator.metrics,
      active: normalized.filter(milestone => !milestone.completed_at),
      completed: normalized.filter(milestone =>
        Boolean(milestone.completed_at)
      ),
    });
  } catch (error) {
    console.error("[milestones] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createMilestoneSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { type, target, title, reward_description } = bodyResult.data;

  try {
    await ensureMilestonesSchema();

    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int AS active_count
      FROM route_f_milestones
      WHERE creator_id = ${session.userId}
        AND completed_at IS NULL
    `;

    if (Number(countRows[0]?.active_count ?? 0) >= 5) {
      return NextResponse.json(
        { error: "Creators may only have 5 active milestones" },
        { status: 409 }
      );
    }

    const { rows } = await sql`
      INSERT INTO route_f_milestones (creator_id, type, target, title, reward_description)
      VALUES (${session.userId}, ${type}, ${target}, ${title}, ${reward_description ?? null})
      RETURNING id, creator_id, type, target, title, reward_description, completed_at, created_at, updated_at
    `;

    return NextResponse.json(
      {
        ...rows[0],
        target: Number(rows[0].target),
        progress: 0,
        is_completed: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[milestones] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
