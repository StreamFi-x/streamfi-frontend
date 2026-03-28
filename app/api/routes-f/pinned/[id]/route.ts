import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensurePinnedTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS creator_pins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id UUID NOT NULL,
      item_type VARCHAR(20) NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT creator_pins_item_type_check
        CHECK (item_type IN ('clip', 'recording')),
      CONSTRAINT creator_pins_unique_item
        UNIQUE (creator_id, item_type, item_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_creator_pins_creator_position
    ON creator_pins (creator_id, position, created_at)
  `;
}

async function getCreatorPinIds(creatorId: string) {
  const result = await sql<{ id: string }>`
    SELECT id
    FROM creator_pins
    WHERE creator_id = ${creatorId}
    ORDER BY position ASC, created_at ASC
  `;

  return result.rows.map(row => row.id);
}

async function normalisePositions(creatorId: string, orderedIds: string[]) {
  for (let index = 0; index < orderedIds.length; index += 1) {
    await sql`
      UPDATE creator_pins
      SET position = ${index}, updated_at = NOW()
      WHERE id = ${orderedIds[index]} AND creator_id = ${creatorId}
    `;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensurePinnedTable();

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid pin ID" }, { status: 400 });
    }

    const pinResult = await sql<{ id: string }>`
      DELETE FROM creator_pins
      WHERE id = ${id} AND creator_id = ${session.userId}
      RETURNING id
    `;

    if (pinResult.rows.length === 0) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    const remainingIds = await getCreatorPinIds(session.userId);
    await normalisePositions(session.userId, remainingIds);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[routes-f/pinned/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to unpin content" },
      { status: 500 }
    );
  }
}
