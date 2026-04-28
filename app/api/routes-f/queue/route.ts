import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";

const createQueueSchema = z.object({
  title: z.string().min(1).max(160),
  scheduled_at: z.coerce.date(),
  category: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
});

const listQueueSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: uuidSchema.optional(),
});

async function ensureQueueTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS creator_stream_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_creator_stream_queue_creator_scheduled
    ON creator_stream_queue (creator_id, scheduled_at ASC)
  `;
}

async function hasOverlap(
  creatorId: string,
  scheduledAt: Date,
  excludeId?: string
) {
  const { rows } = excludeId
    ? await sql`
        SELECT 1
        FROM creator_stream_queue
        WHERE creator_id = ${creatorId}
          AND id != ${excludeId}
          AND ABS(EXTRACT(EPOCH FROM (scheduled_at - ${scheduledAt.toISOString()}::timestamptz))) < 1800
        LIMIT 1
      `
    : await sql`
        SELECT 1
        FROM creator_stream_queue
        WHERE creator_id = ${creatorId}
          AND ABS(EXTRACT(EPOCH FROM (scheduled_at - ${scheduledAt.toISOString()}::timestamptz))) < 1800
        LIMIT 1
      `;

  return rows.length > 0;
}

async function upcomingCount(creatorId: string, excludeId?: string) {
  const { rows } = excludeId
    ? await sql`
        SELECT COUNT(*)::int AS total
        FROM creator_stream_queue
        WHERE creator_id = ${creatorId}
          AND id != ${excludeId}
          AND scheduled_at > NOW()
      `
    : await sql`
        SELECT COUNT(*)::int AS total
        FROM creator_stream_queue
        WHERE creator_id = ${creatorId}
          AND scheduled_at > NOW()
      `;

  return Number(rows[0]?.total ?? 0);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    listQueueSchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { limit, cursor } = queryResult.data;

  try {
    await ensureQueueTable();

    const { rows } = cursor
      ? await sql`
          SELECT id, title, scheduled_at, category, description, created_at, updated_at
          FROM creator_stream_queue
          WHERE creator_id = ${session.userId}
            AND scheduled_at > NOW()
            AND scheduled_at > (
              SELECT scheduled_at
              FROM creator_stream_queue
              WHERE id = ${cursor}
              LIMIT 1
            )
          ORDER BY scheduled_at ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, title, scheduled_at, category, description, created_at, updated_at
          FROM creator_stream_queue
          WHERE creator_id = ${session.userId}
            AND scheduled_at > NOW()
          ORDER BY scheduled_at ASC
          LIMIT ${limit}
        `;

    const nextCursor =
      rows.length === limit ? (rows[rows.length - 1].id as string) : null;
    return NextResponse.json({ queue: rows, next_cursor: nextCursor });
  } catch (err) {
    console.error("[queue] GET error:", err);
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

  const bodyResult = await validateBody(req, createQueueSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { title, scheduled_at, category, description } = bodyResult.data;

  if (scheduled_at.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "scheduled_at must be in the future" },
      { status: 400 }
    );
  }

  try {
    await ensureQueueTable();

    const count = await upcomingCount(session.userId);
    if (count >= 10) {
      return NextResponse.json(
        { error: "Maximum of 10 upcoming scheduled streams reached" },
        { status: 400 }
      );
    }

    if (await hasOverlap(session.userId, scheduled_at)) {
      return NextResponse.json(
        { error: "Scheduled stream overlaps with an existing slot" },
        { status: 409 }
      );
    }

    const { rows } = await sql`
      INSERT INTO creator_stream_queue (creator_id, title, scheduled_at, category, description)
      VALUES (
        ${session.userId},
        ${title},
        ${scheduled_at.toISOString()},
        ${category},
        ${description ?? null}
      )
      RETURNING id, title, scheduled_at, category, description, created_at, updated_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[queue] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
