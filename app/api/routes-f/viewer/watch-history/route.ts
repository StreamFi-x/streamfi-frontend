import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const getQuerySchema = z.object({
  viewer_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

const postBodySchema = z.object({
  viewer_id: z.string().uuid(),
  target_type: z.enum(["stream", "vod"]),
  target_id: z.string().uuid(),
  watched_at: z.string().datetime().optional(),
});

async function ensureWatchHistoryTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS viewer_watch_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      viewer_id UUID NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('stream', 'vod')),
      target_id UUID NOT NULL,
      watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (viewer_id, target_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_viewer_watch_history_viewer_watched
    ON viewer_watch_history (viewer_id, watched_at DESC)
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

  const { viewer_id, limit } = queryResult.data;

  try {
    await ensureWatchHistoryTable();

    const { rows } = await sql`
      SELECT
        id,
        viewer_id,
        target_type,
        target_id,
        watched_at,
        created_at,
        updated_at
      FROM viewer_watch_history
      WHERE viewer_id = ${viewer_id}
      ORDER BY watched_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({ entries: rows });
  } catch (error) {
    console.error("[routes-f viewer/watch-history GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch watch history" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, postBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { viewer_id, target_type, target_id, watched_at } = bodyResult.data;

  try {
    await ensureWatchHistoryTable();

    const now = watched_at ?? new Date().toISOString();

    const { rows } = await sql`
      INSERT INTO viewer_watch_history (viewer_id, target_type, target_id, watched_at, created_at, updated_at)
      VALUES (${viewer_id}, ${target_type}, ${target_id}, ${now}, NOW(), NOW())
      ON CONFLICT (viewer_id, target_id)
      DO UPDATE SET
        watched_at = GREATEST(viewer_watch_history.watched_at, EXCLUDED.watched_at),
        updated_at = NOW()
      RETURNING id, viewer_id, target_type, target_id, watched_at, created_at, updated_at
    `;

    return NextResponse.json({ entry: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("[routes-f viewer/watch-history POST]", error);
    return NextResponse.json(
      { error: "Failed to record watch history" },
      { status: 500 }
    );
  }
}
