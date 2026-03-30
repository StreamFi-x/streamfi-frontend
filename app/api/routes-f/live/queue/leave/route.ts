import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureLiveQueueSchema } from "../_lib/db";

const leaveQueueSchema = z.object({
  stream_id: z.string().uuid(),
});

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, leaveQueueSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureLiveQueueSchema();

    const { rows } = await sql<{ id: string }>`
      UPDATE route_f_live_queue_entries
      SET status = 'left', left_at = NOW()
      WHERE id = (
        SELECT id
        FROM route_f_live_queue_entries
        WHERE stream_id = ${bodyResult.data.stream_id}
          AND viewer_id = ${session.userId}
          AND status = 'queued'
        ORDER BY joined_at ASC, id ASC
        LIMIT 1
      )
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Viewer is not in the queue" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      stream_id: bodyResult.data.stream_id,
      deleted: true,
    });
  } catch (error) {
    console.error("[routes-f live/queue/leave DELETE]", error);
    return NextResponse.json(
      { error: "Failed to leave queue" },
      { status: 500 }
    );
  }
}
