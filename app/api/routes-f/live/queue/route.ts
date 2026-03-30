import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureLiveQueueSchema } from "./_lib/db";

const queueQuerySchema = z.object({
  stream_id: z.string().uuid(),
});

const updateQueueSchema = z.object({
  stream_id: z.string().uuid(),
  open: z.boolean(),
});

type StreamOwnerRow = {
  id: string;
  user_id: string;
};

async function getStreamOwner(
  streamId: string
): Promise<StreamOwnerRow | null> {
  const { rows } = await sql<StreamOwnerRow>`
    SELECT id, user_id
    FROM stream_sessions
    WHERE id = ${streamId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function ensureQueueSettings(streamId: string, creatorId: string) {
  await sql`
    INSERT INTO route_f_live_queue_settings (stream_id, creator_id, is_open)
    VALUES (${streamId}, ${creatorId}, true)
    ON CONFLICT (stream_id) DO NOTHING
  `;
}

async function getQueueSummary(streamId: string, viewerId?: string | null) {
  const [{ rows: settingsRows }, { rows: totalRows }] = await Promise.all([
    sql<{ is_open: boolean }>`
      SELECT is_open
      FROM route_f_live_queue_settings
      WHERE stream_id = ${streamId}
      LIMIT 1
    `,
    sql<{ total: number }>`
      SELECT COUNT(*)::int AS total
      FROM route_f_live_queue_entries
      WHERE stream_id = ${streamId}
        AND status = 'queued'
    `,
  ]);

  let position: number | null = null;
  if (viewerId) {
    const { rows } = await sql<{ position: number }>`
      SELECT position
      FROM (
        SELECT
          viewer_id,
          ROW_NUMBER() OVER (ORDER BY joined_at ASC, id ASC)::int AS position
        FROM route_f_live_queue_entries
        WHERE stream_id = ${streamId}
          AND status = 'queued'
      ) ranked
      WHERE viewer_id = ${viewerId}
      LIMIT 1
    `;

    position = rows[0]?.position ?? null;
  }

  return {
    stream_id: streamId,
    open: settingsRows[0]?.is_open ?? true,
    total: Number(totalRows[0]?.total ?? 0),
    position,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    queueQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const bestEffortSession = await verifySession(req);

  try {
    await ensureLiveQueueSchema();

    const stream = await getStreamOwner(queryResult.data.stream_id);
    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    await ensureQueueSettings(stream.id, stream.user_id);

    return NextResponse.json(
      await getQueueSummary(
        stream.id,
        bestEffortSession.ok ? bestEffortSession.userId : null
      ),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[routes-f live/queue GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch queue state" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, updateQueueSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureLiveQueueSchema();

    const stream = await getStreamOwner(bodyResult.data.stream_id);
    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    if (stream.user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql`
      INSERT INTO route_f_live_queue_settings (stream_id, creator_id, is_open)
      VALUES (${stream.id}, ${session.userId}, ${bodyResult.data.open})
      ON CONFLICT (stream_id) DO UPDATE SET
        is_open = EXCLUDED.is_open,
        updated_at = NOW()
    `;

    return NextResponse.json(await getQueueSummary(stream.id, session.userId));
  } catch (error) {
    console.error("[routes-f live/queue PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update queue state" },
      { status: 500 }
    );
  }
}
