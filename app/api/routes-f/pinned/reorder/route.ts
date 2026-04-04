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

export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensurePinnedTable();

    const payload = await req.json();
    const orderedIds = payload?.ordered_ids;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json(
        { error: "ordered_ids must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!orderedIds.every(id => typeof id === "string" && UUID_RE.test(id))) {
      return NextResponse.json(
        { error: "ordered_ids must contain valid UUIDs" },
        { status: 400 }
      );
    }

    const currentResult = await sql<{ id: string }>`
      SELECT id
      FROM creator_pins
      WHERE creator_id = ${session.userId}
      ORDER BY position ASC, created_at ASC
    `;

    const currentIds = currentResult.rows.map(row => row.id);
    const incomingIds = orderedIds as string[];

    if (currentIds.length !== incomingIds.length) {
      return NextResponse.json(
        { error: "ordered_ids must include every pin for the creator" },
        { status: 400 }
      );
    }

    const currentSet = new Set(currentIds);
    if (
      incomingIds.some(id => !currentSet.has(id)) ||
      new Set(incomingIds).size !== incomingIds.length
    ) {
      return NextResponse.json(
        { error: "ordered_ids must belong to the authenticated creator" },
        { status: 400 }
      );
    }

    for (let index = 0; index < incomingIds.length; index += 1) {
      await sql`
        UPDATE creator_pins
        SET position = ${index}, updated_at = NOW()
        WHERE id = ${incomingIds[index]} AND creator_id = ${session.userId}
      `;
    }

    return NextResponse.json({
      ok: true,
      ordered_ids: incomingIds,
    });
  } catch (error) {
    console.error("[routes-f/pinned/reorder] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to reorder pinned content" },
      { status: 500 }
    );
  }
}
