import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

const chaptersQuerySchema = z.object({
  stream_id: z.string().uuid(),
});

const createChapterSchema = z.object({
  stream_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  timestamp_seconds: z.number().int().min(0),
});

const MAX_CHAPTERS_PER_STREAM = 50;

async function ensureChaptersTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_chapters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      timestamp_seconds INTEGER NOT NULL CHECK (timestamp_seconds >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (stream_id, timestamp_seconds, title)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_chapters_stream_timestamp
    ON stream_chapters (stream_id, timestamp_seconds ASC)
  `;
}

function resolveElapsedSeconds(startedAt: Date, endedAt: Date | null): number {
  const startMs = startedAt.getTime();
  if (Number.isNaN(startMs)) {
    return 0;
  }

  const endMs = endedAt ? endedAt.getTime() : Date.now();
  if (Number.isNaN(endMs) || endMs <= startMs) {
    return 0;
  }

  return Math.floor((endMs - startMs) / 1000);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    chaptersQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { stream_id } = queryResult.data;

  try {
    await ensureChaptersTable();

    const { rows: streamRows } = await sql`
      SELECT id
      FROM stream_sessions
      WHERE id = ${stream_id}
      LIMIT 1
    `;

    if (streamRows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const { rows } = await sql`
      SELECT id, stream_id, creator_id, title, timestamp_seconds, created_at
      FROM stream_chapters
      WHERE stream_id = ${stream_id}
      ORDER BY timestamp_seconds ASC, created_at ASC
    `;

    return NextResponse.json({ chapters: rows });
  } catch (error) {
    console.error("[routes-f stream/chapters GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch stream chapters" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createChapterSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { stream_id, title, timestamp_seconds } = bodyResult.data;

  try {
    await ensureChaptersTable();

    const { rows: streamRows } = await sql<{
      id: string;
      user_id: string;
      started_at: string;
      ended_at: string | null;
    }>`
      SELECT id, user_id, started_at, ended_at
      FROM stream_sessions
      WHERE id = ${stream_id}
      LIMIT 1
    `;

    if (streamRows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const stream = streamRows[0];

    if (String(stream.user_id) !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const startedAt = new Date(stream.started_at);
    const endedAt = stream.ended_at ? new Date(stream.ended_at) : null;
    const elapsedSeconds = resolveElapsedSeconds(startedAt, endedAt);

    if (timestamp_seconds > elapsedSeconds) {
      return NextResponse.json(
        {
          error:
            "timestamp_seconds must be less than or equal to current stream elapsed time",
          elapsed_seconds: elapsedSeconds,
        },
        { status: 400 }
      );
    }

    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int AS total
      FROM stream_chapters
      WHERE stream_id = ${stream_id}
    `;

    const count = Number(countRows[0]?.total ?? 0);
    if (count >= MAX_CHAPTERS_PER_STREAM) {
      return NextResponse.json(
        { error: "Maximum of 50 chapters per stream reached" },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      INSERT INTO stream_chapters (
        stream_id,
        creator_id,
        title,
        timestamp_seconds
      )
      VALUES (
        ${stream_id},
        ${session.userId},
        ${title},
        ${timestamp_seconds}
      )
      RETURNING id, stream_id, creator_id, title, timestamp_seconds, created_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[routes-f stream/chapters POST]", error);
    return NextResponse.json(
      { error: "Failed to create chapter" },
      { status: 500 }
    );
  }
}
