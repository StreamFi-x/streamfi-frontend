import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

async function ensureRerunsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_reruns (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recording_id     VARCHAR(255) NOT NULL,
      scheduled_at     TIMESTAMPTZ NOT NULL,
      notify_followers BOOLEAN     NOT NULL DEFAULT false,
      notified         BOOLEAN     NOT NULL DEFAULT false,
      cancelled        BOOLEAN     NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

/** DELETE /api/routes-f/stream/rerun/[id] — cancel a scheduled rerun */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    await ensureRerunsTable();

    const { rows } = await sql`
      SELECT id, creator_id, cancelled, scheduled_at
      FROM stream_reruns
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Rerun not found" }, { status: 404 });
    }

    const rerun = rows[0];

    if (String(rerun.creator_id) !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (rerun.cancelled) {
      return NextResponse.json(
        { error: "Rerun already cancelled" },
        { status: 409 }
      );
    }

    await sql`
      UPDATE stream_reruns SET cancelled = true WHERE id = ${id}
    `;

    return NextResponse.json({ message: "Rerun cancelled" });
  } catch (error) {
    console.error("[routes-f stream/rerun/:id DELETE]", error);
    return NextResponse.json(
      { error: "Failed to cancel rerun" },
      { status: 500 }
    );
  }
}
