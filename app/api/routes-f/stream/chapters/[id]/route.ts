import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

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
}

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
    await ensureChaptersTable();

    const { rows } = await sql`
      SELECT creator_id
      FROM stream_chapters
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    if (String(rows[0].creator_id) !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql`
      DELETE FROM stream_chapters
      WHERE id = ${id}
    `;

    return NextResponse.json({ message: "Chapter removed" });
  } catch (error) {
    console.error("[routes-f stream/chapters/:id DELETE]", error);
    return NextResponse.json(
      { error: "Failed to remove chapter" },
      { status: 500 }
    );
  }
}
