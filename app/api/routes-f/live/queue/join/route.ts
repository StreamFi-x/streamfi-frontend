import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureLiveQueueSchema } from "../_lib/db";

const joinQueueSchema = z.object({
  stream_id: z.string().uuid(),
});

async function getStreamOwner(streamId: string) {
  const { rows } = await sql<{ id: string; user_id: string }>`
    SELECT id, user_id
    FROM stream_sessions
    WHERE id = ${streamId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, joinQueueSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureLiveQueueSchema();

    const stream = await getStreamOwner(bodyResult.data.stream_id);
    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    await sql`
      INSERT INTO route_f_live_queue_settings (stream_id, creator_id, is_open)
      VALUES (${stream.id}, ${stream.user_id}, true)
      ON CONFLICT (stream_id) DO NOTHING
    `;

    const [
      { rows: settingsRows },
      { rows: existingRows },
      { rows: countRows },
    ] = await Promise.all([
      sql<{ is_open: boolean }>`
          SELECT is_open
          FROM route_f_live_queue_settings
          WHERE stream_id = ${stream.id}
          LIMIT 1
        `,
      sql<{ id: string }>`
          SELECT id
          FROM route_f_live_queue_entries
          WHERE stream_id = ${stream.id}
            AND viewer_id = ${session.userId}
            AND status = 'queued'
          LIMIT 1
        `,
      sql<{ total: number }>`
          SELECT COUNT(*)::int AS total
          FROM route_f_live_queue_entries
          WHERE stream_id = ${stream.id}
            AND status = 'queued'
        `,
    ]);

    if (settingsRows[0] && settingsRows[0].is_open === false) {
      return NextResponse.json({ error: "Queue is closed" }, { status: 409 });
    }

    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: "Viewer is already in the queue" },
        { status: 409 }
      );
    }

    if (Number(countRows[0]?.total ?? 0) >= 100) {
      return NextResponse.json({ error: "Queue is full" }, { status: 409 });
    }

    await sql`
      INSERT INTO route_f_live_queue_entries (stream_id, viewer_id, status)
      VALUES (${stream.id}, ${session.userId}, 'queued')
    `;

    const { rows: positionRows } = await sql<{
      position: number;
      total: number;
    }>`
      SELECT
        position,
        total
      FROM (
        SELECT
          viewer_id,
          ROW_NUMBER() OVER (ORDER BY joined_at ASC, id ASC)::int AS position,
          COUNT(*) OVER ()::int AS total
        FROM route_f_live_queue_entries
        WHERE stream_id = ${stream.id}
          AND status = 'queued'
      ) ranked
      WHERE viewer_id = ${session.userId}
      LIMIT 1
    `;

    return NextResponse.json(
      {
        stream_id: stream.id,
        open: true,
        position: Number(positionRows[0]?.position ?? 0),
        total: Number(positionRows[0]?.total ?? 0),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f live/queue/join POST]", error);
    return NextResponse.json(
      { error: "Failed to join queue" },
      { status: 500 }
    );
  }
}
