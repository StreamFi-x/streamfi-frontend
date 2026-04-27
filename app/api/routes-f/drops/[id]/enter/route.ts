import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

async function ensureDropTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_drops (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward TEXT NOT NULL,
      eligible_viewers TEXT NOT NULL CHECK (eligible_viewers IN ('all', 'subscribers')),
      winner_count INTEGER NOT NULL CHECK (winner_count > 0),
      ends_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
      winners JSONB,
      drawn_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS stream_drop_entries (
      drop_id UUID NOT NULL REFERENCES stream_drops(id) ON DELETE CASCADE,
      viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (drop_id, viewer_id)
    )
  `;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    await ensureDropTables();

    await sql`
      UPDATE stream_drops
      SET status = 'closed', updated_at = NOW()
      WHERE id = ${id}
        AND status = 'active'
        AND ends_at <= NOW()
    `;

    const { rows: dropRows } = await sql`
      SELECT id, creator_id, eligible_viewers, status, ends_at
      FROM stream_drops
      WHERE id = ${id}
      LIMIT 1
    `;

    if (dropRows.length === 0) {
      return NextResponse.json({ error: "Drop not found" }, { status: 404 });
    }

    const drop = dropRows[0];
    if (
      drop.status !== "active" ||
      new Date(String(drop.ends_at)).getTime() <= Date.now()
    ) {
      return NextResponse.json({ error: "Drop is closed" }, { status: 409 });
    }

    if (String(drop.eligible_viewers) === "subscribers") {
      const { rows: subRows } = await sql`
        SELECT 1
        FROM subscriptions
        WHERE creator_id = ${drop.creator_id}
          AND supporter_id = ${session.userId}
          AND status = 'active'
        LIMIT 1
      `;

      if (subRows.length === 0) {
        return NextResponse.json(
          { error: "Only active subscribers can enter this drop" },
          { status: 403 }
        );
      }
    }

    const { rowCount } = await sql`
      INSERT INTO stream_drop_entries (drop_id, viewer_id)
      VALUES (${id}, ${session.userId})
      ON CONFLICT DO NOTHING
    `;

    if ((rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Viewer has already entered this drop" },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Entry recorded" }, { status: 201 });
  } catch (error) {
    console.error("[routes-f drops/:id/enter POST]", error);
    return NextResponse.json(
      { error: "Failed to enter drop" },
      { status: 500 }
    );
  }
}
