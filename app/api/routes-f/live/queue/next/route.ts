import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureLiveQueueSchema } from "../_lib/db";

const nextQueueSchema = z.object({
  stream_id: z.string().uuid(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, nextQueueSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureLiveQueueSchema();

    const { rows: streamRows } = await sql<{ user_id: string }>`
      SELECT user_id
      FROM stream_sessions
      WHERE id = ${bodyResult.data.stream_id}
      LIMIT 1
    `;

    if (streamRows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    if (streamRows[0].user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { rows } = await sql<{
      id: string;
      viewer_id: string;
      username: string | null;
      advanced_at: string;
    }>`
      WITH next_entry AS (
        SELECT id, viewer_id
        FROM route_f_live_queue_entries
        WHERE stream_id = ${bodyResult.data.stream_id}
          AND status = 'queued'
        ORDER BY joined_at ASC, id ASC
        LIMIT 1
      )
      UPDATE route_f_live_queue_entries q
      SET status = 'completed', advanced_at = NOW()
      FROM next_entry ne
      LEFT JOIN users u ON u.id = ne.viewer_id
      WHERE q.id = ne.id
      RETURNING q.id, q.viewer_id, u.username, q.advanced_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Queue is empty" }, { status: 404 });
    }

    const { rows: totalRows } = await sql<{ total: number }>`
      SELECT COUNT(*)::int AS total
      FROM route_f_live_queue_entries
      WHERE stream_id = ${bodyResult.data.stream_id}
        AND status = 'queued'
    `;

    return NextResponse.json({
      stream_id: bodyResult.data.stream_id,
      advanced: {
        viewer_id: rows[0].viewer_id,
        username: rows[0].username,
        advanced_at: rows[0].advanced_at,
      },
      remaining_total: Number(totalRows[0]?.total ?? 0),
    });
  } catch (error) {
    console.error("[routes-f live/queue/next POST]", error);
    return NextResponse.json(
      { error: "Failed to advance queue" },
      { status: 500 }
    );
  }
}
