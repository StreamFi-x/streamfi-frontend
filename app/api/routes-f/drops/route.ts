import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

const eligibleViewersSchema = z.enum(["all", "subscribers"]);

const listDropsSchema = z.object({
  creator: z.string().min(1),
});

const createDropSchema = z.object({
  stream_id: z.string().uuid(),
  reward: z.string().trim().min(1).max(500),
  eligible_viewers: eligibleViewersSchema,
  winner_count: z.number().int().min(1).max(100),
  ends_at: z.coerce.date(),
});

async function ensureDropTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_drops (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward TEXT NOT NULL,
      eligible_viewers TEXT NOT NULL CHECK (eligible_viewers IN ('all', 'subscribers')),
      winner_count INTEGER NOT NULL CHECK (winner_count > 0),
      ends_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
      winners JSONB,
      drawn_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS stream_drop_entries (
      drop_id UUID NOT NULL REFERENCES stream_drops(id) ON DELETE CASCADE,
      viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (drop_id, viewer_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_drops_creator_status
    ON stream_drops (creator_id, status, ends_at ASC)
  `;
}

async function closeExpiredDrops(creatorId?: string) {
  if (creatorId) {
    await sql`
      UPDATE stream_drops
      SET status = 'closed', updated_at = NOW()
      WHERE creator_id = ${creatorId}
        AND status = 'active'
        AND ends_at <= NOW()
    `;
    return;
  }

  await sql`
    UPDATE stream_drops
    SET status = 'closed', updated_at = NOW()
    WHERE status = 'active'
      AND ends_at <= NOW()
  `;
}

async function resolveCreatorId(input: string): Promise<string | null> {
  const maybeUuid = z.string().uuid().safeParse(input);

  const { rows } = maybeUuid.success
    ? await sql`SELECT id FROM users WHERE id = ${input} LIMIT 1`
    : await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${input}) LIMIT 1`;

  if (rows.length === 0) {
    return null;
  }

  return String(rows[0].id);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    listDropsSchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureDropTables();

    const creatorId = await resolveCreatorId(queryResult.data.creator);
    if (!creatorId) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    await closeExpiredDrops(creatorId);

    const { rows } = await sql`
      SELECT
        d.id,
        d.stream_id,
        d.creator_id,
        d.reward,
        d.eligible_viewers,
        d.winner_count,
        d.ends_at,
        d.status,
        d.winners,
        d.drawn_at,
        d.created_at,
        d.updated_at,
        COALESCE(COUNT(e.viewer_id), 0)::int AS entry_count
      FROM stream_drops d
      LEFT JOIN stream_drop_entries e ON e.drop_id = d.id
      WHERE d.creator_id = ${creatorId}
        AND d.status = 'active'
      GROUP BY d.id
      ORDER BY d.ends_at ASC
    `;

    return NextResponse.json({ drops: rows });
  } catch (error) {
    console.error("[routes-f drops GET]", error);
    return NextResponse.json(
      { error: "Failed to list active drops" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createDropSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { stream_id, reward, eligible_viewers, winner_count, ends_at } =
    bodyResult.data;

  if (ends_at.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "ends_at must be in the future" },
      { status: 400 }
    );
  }

  try {
    await ensureDropTables();

    const { rows: streamRows } = await sql`
      SELECT id
      FROM stream_sessions
      WHERE id = ${stream_id}
        AND user_id = ${session.userId}
      LIMIT 1
    `;

    if (streamRows.length === 0) {
      return NextResponse.json(
        { error: "Stream not found or not owned by user" },
        { status: 404 }
      );
    }

    const { rows } = await sql`
      INSERT INTO stream_drops (
        stream_id,
        creator_id,
        reward,
        eligible_viewers,
        winner_count,
        ends_at,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${stream_id},
        ${session.userId},
        ${reward},
        ${eligible_viewers},
        ${winner_count},
        ${ends_at.toISOString()},
        'active',
        NOW(),
        NOW()
      )
      RETURNING id, stream_id, creator_id, reward, eligible_viewers, winner_count, ends_at, status, created_at, updated_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[routes-f drops POST]", error);
    return NextResponse.json(
      { error: "Failed to create drop" },
      { status: 500 }
    );
  }
}
