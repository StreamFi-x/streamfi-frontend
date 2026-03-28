import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

async function ensurePollsTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_polls (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id        UUID        NOT NULL,
      creator_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question         TEXT        NOT NULL,
      options          JSONB       NOT NULL,
      duration_seconds INTEGER     NOT NULL CHECK (duration_seconds BETWEEN 1 AND 300),
      ends_at          TIMESTAMPTZ NOT NULL,
      ended_early      BOOLEAN     NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

/** DELETE /api/routes-f/stream/polls/[id] — creator ends a poll early */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { id } = await params;

  try {
    await ensurePollsTables();

    const { rows } = await sql`
      SELECT id, creator_id, ended_early, ends_at
      FROM stream_polls
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    const poll = rows[0];

    if (String(poll.creator_id) !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (poll.ended_early || new Date(poll.ends_at) <= new Date()) {
      return NextResponse.json({ error: "Poll has already ended" }, { status: 409 });
    }

    await sql`
      UPDATE stream_polls SET ended_early = true WHERE id = ${id}
    `;

    return NextResponse.json({ message: "Poll ended" });
  } catch (error) {
    console.error("[routes-f stream/polls/:id DELETE]", error);
    return NextResponse.json({ error: "Failed to end poll" }, { status: 500 });
  }
}
