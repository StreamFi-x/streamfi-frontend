import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONCURRENT_SESSIONS = 3;

const getQuerySchema = z.object({
  viewer_id: z.string().uuid(),
});

const postBodySchema = z.object({
  viewer_id: z.string().uuid(),
  session_id: z.string().uuid(),
  playback_id: z.string().min(1),
});

const deleteBodySchema = z.object({
  viewer_id: z.string().uuid(),
  session_id: z.string().uuid(),
});

async function ensureSessionsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS viewer_playback_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      viewer_id UUID NOT NULL,
      session_id UUID NOT NULL,
      playback_id TEXT NOT NULL,
      registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (viewer_id, session_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_viewer_playback_sessions_viewer
    ON viewer_playback_sessions (viewer_id)
  `;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    getQuerySchema
  );
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { viewer_id } = queryResult.data;

  try {
    await ensureSessionsTable();

    const { rows } = await sql`
      SELECT id, viewer_id, session_id, playback_id, registered_at
      FROM viewer_playback_sessions
      WHERE viewer_id = ${viewer_id}
      ORDER BY registered_at DESC
    `;

    return NextResponse.json({
      active_sessions: rows,
      limit: MAX_CONCURRENT_SESSIONS,
    });
  } catch (error) {
    console.error("[routes-f viewer/sessions GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch active sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, postBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { viewer_id, session_id, playback_id } = bodyResult.data;

  try {
    await ensureSessionsTable();

    const { rows: existing } = await sql`
      SELECT id FROM viewer_playback_sessions
      WHERE viewer_id = ${viewer_id} AND session_id = ${session_id}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({
        active_sessions: existing.length,
        limit: MAX_CONCURRENT_SESSIONS,
        message: "Session already registered",
      });
    }

    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int AS total
      FROM viewer_playback_sessions
      WHERE viewer_id = ${viewer_id}
    `;

    const currentCount = Number(countRows[0]?.total ?? 0);

    if (currentCount >= MAX_CONCURRENT_SESSIONS) {
      return NextResponse.json(
        {
          error: "Concurrent session limit reached",
          active_sessions: currentCount,
          limit: MAX_CONCURRENT_SESSIONS,
        },
        { status: 429 }
      );
    }

    await sql`
      INSERT INTO viewer_playback_sessions (viewer_id, session_id, playback_id, registered_at)
      VALUES (${viewer_id}, ${session_id}, ${playback_id}, NOW())
    `;

    return NextResponse.json({
      active_sessions: currentCount + 1,
      limit: MAX_CONCURRENT_SESSIONS,
    });
  } catch (error) {
    console.error("[routes-f viewer/sessions POST]", error);
    return NextResponse.json(
      { error: "Failed to register session" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, deleteBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { viewer_id, session_id } = bodyResult.data;

  try {
    await ensureSessionsTable();

    const { rowCount } = await sql`
      DELETE FROM viewer_playback_sessions
      WHERE viewer_id = ${viewer_id} AND session_id = ${session_id}
    `;

    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int AS total
      FROM viewer_playback_sessions
      WHERE viewer_id = ${viewer_id}
    `;

    return NextResponse.json({
      removed: (rowCount ?? 0) > 0,
      active_sessions: Number(countRows[0]?.total ?? 0),
      limit: MAX_CONCURRENT_SESSIONS,
    });
  } catch (error) {
    console.error("[routes-f viewer/sessions DELETE]", error);
    return NextResponse.json(
      { error: "Failed to remove session" },
      { status: 500 }
    );
  }
}
