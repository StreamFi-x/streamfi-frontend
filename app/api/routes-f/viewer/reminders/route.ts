import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getQuerySchema = z.object({
  viewer_id: z.string().uuid(),
});

const postBodySchema = z.object({
  viewer_id: z.string().uuid(),
  scheduled_stream_id: z.string().uuid(),
});

const deleteBodySchema = z.object({
  viewer_id: z.string().uuid(),
  scheduled_stream_id: z.string().uuid(),
});

async function ensureRemindersTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      viewer_id UUID NOT NULL,
      scheduled_stream_id UUID NOT NULL,
      fires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (viewer_id, scheduled_stream_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_reminders_viewer_fires
    ON stream_reminders (viewer_id, fires_at DESC)
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
    await ensureRemindersTable();

    const { rows } = await sql`
      SELECT
        r.id,
        r.viewer_id,
        r.scheduled_stream_id,
        r.fires_at,
        r.created_at
      FROM stream_reminders r
      WHERE r.viewer_id = ${viewer_id}
        AND r.fires_at > NOW()
      ORDER BY r.fires_at ASC
    `;

    return NextResponse.json({ reminders: rows });
  } catch (error) {
    console.error("[routes-f viewer/reminders GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, postBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { viewer_id, scheduled_stream_id } = bodyResult.data;

  try {
    await ensureRemindersTable();

    const { rows: streamRows } = await sql`
      SELECT id, scheduled_at
      FROM scheduled_streams
      WHERE id = ${scheduled_stream_id}
      LIMIT 1
    `;

    if (streamRows.length === 0) {
      return NextResponse.json(
        { error: "Scheduled stream not found" },
        { status: 404 }
      );
    }

    const firesAt = streamRows[0].scheduled_at;

    const { rows } = await sql`
      INSERT INTO stream_reminders (viewer_id, scheduled_stream_id, fires_at, created_at)
      VALUES (${viewer_id}, ${scheduled_stream_id}, ${firesAt}, NOW())
      ON CONFLICT (viewer_id, scheduled_stream_id)
      DO UPDATE SET fires_at = EXCLUDED.fires_at
      RETURNING id, viewer_id, scheduled_stream_id, fires_at, created_at
    `;

    return NextResponse.json({
      reminder_set: true,
      fires_at: rows[0].fires_at,
      reminder: rows[0],
    });
  } catch (error) {
    console.error("[routes-f viewer/reminders POST]", error);
    return NextResponse.json(
      { error: "Failed to set reminder" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, deleteBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { viewer_id, scheduled_stream_id } = bodyResult.data;

  try {
    await ensureRemindersTable();

    const { rowCount } = await sql`
      DELETE FROM stream_reminders
      WHERE viewer_id = ${viewer_id} AND scheduled_stream_id = ${scheduled_stream_id}
    `;

    return NextResponse.json({
      removed: (rowCount ?? 0) > 0,
    });
  } catch (error) {
    console.error("[routes-f viewer/reminders DELETE]", error);
    return NextResponse.json(
      { error: "Failed to remove reminder" },
      { status: 500 }
    );
  }
}
