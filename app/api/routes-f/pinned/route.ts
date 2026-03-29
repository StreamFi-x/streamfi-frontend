import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

type PinItemType = "clip" | "recording";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clampPosition(position: number, maxIndex: number) {
  if (!Number.isFinite(position)) {
    return maxIndex;
  }
  return Math.max(0, Math.min(Math.trunc(position), maxIndex));
}

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

async function normalisePositions(creatorId: string, orderedIds: string[]) {
  for (let index = 0; index < orderedIds.length; index += 1) {
    await sql`
      UPDATE creator_pins
      SET position = ${index}, updated_at = NOW()
      WHERE id = ${orderedIds[index]} AND creator_id = ${creatorId}
    `;
  }
}

async function ensureOwnedRecording(recordingId: string, creatorId: string) {
  const result = await sql`
    SELECT id
    FROM stream_recordings
    WHERE id = ${recordingId} AND user_id = ${creatorId}
    LIMIT 1
  `;

  return result.rows.length > 0;
}

export async function GET(req: NextRequest) {
  try {
    await ensurePinnedTable();

    const creator = new URL(req.url).searchParams.get("creator")?.trim();
    if (!creator) {
      return NextResponse.json(
        { error: "creator is required" },
        { status: 400 }
      );
    }

    const creatorResult = await sql<{ id: string; username: string }>`
      SELECT id, username
      FROM users
      WHERE id::text = ${creator} OR LOWER(username) = LOWER(${creator})
      LIMIT 1
    `;

    const creatorRow = creatorResult.rows[0];
    if (!creatorRow) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const result = await sql<{
      pin_id: string;
      item_id: string;
      item_type: PinItemType;
      position: number;
      created_at: string | Date;
      playback_id: string;
      title: string | null;
      duration: number | null;
      recording_created_at: string | Date;
      status: string;
      needs_review: boolean | null;
    }>`
      SELECT
        p.id AS pin_id,
        p.item_id::text AS item_id,
        p.item_type,
        p.position,
        p.created_at,
        r.playback_id,
        r.title,
        r.duration,
        r.created_at AS recording_created_at,
        r.status,
        r.needs_review
      FROM creator_pins p
      JOIN stream_recordings r ON r.id = p.item_id
      WHERE p.creator_id = ${creatorRow.id}
      ORDER BY p.position ASC, p.created_at ASC
    `;

    return NextResponse.json({
      creator: creatorRow.username,
      items: result.rows.map(row => ({
        id: row.pin_id,
        item_id: row.item_id,
        item_type: row.item_type,
        position: row.position,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
        item: {
          id: row.item_id,
          playback_id: row.playback_id,
          title: row.title,
          duration: row.duration,
          created_at:
            row.recording_created_at instanceof Date
              ? row.recording_created_at.toISOString()
              : row.recording_created_at,
          status: row.status,
          needs_review: row.needs_review ?? false,
          thumbnail_url: `https://image.mux.com/${row.playback_id}/thumbnail.jpg`,
        },
      })),
    });
  } catch (error) {
    console.error("[routes-f/pinned] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pinned content" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensurePinnedTable();

    const payload = await req.json();
    const itemId = payload?.item_id;
    const itemType = payload?.item_type;
    const requestedPosition = Number(payload?.position ?? Number.MAX_SAFE_INTEGER);

    if (typeof itemId !== "string" || !UUID_RE.test(itemId)) {
      return NextResponse.json(
        { error: "item_id must be a valid UUID" },
        { status: 400 }
      );
    }

    if (itemType !== "clip" && itemType !== "recording") {
      return NextResponse.json(
        { error: "item_type must be clip or recording" },
        { status: 400 }
      );
    }

    const ownsItem = await ensureOwnedRecording(itemId, session.userId);
    if (!ownsItem) {
      return NextResponse.json(
        { error: "Item not found for creator" },
        { status: 404 }
      );
    }

    const existingPins = await sql<{ id: string }>`
      SELECT id
      FROM creator_pins
      WHERE creator_id = ${session.userId}
      ORDER BY position ASC, created_at ASC
    `;

    if (existingPins.rows.length >= 6) {
      return NextResponse.json(
        { error: "Creators can pin at most 6 items" },
        { status: 409 }
      );
    }

    const alreadyPinned = await sql`
      SELECT id
      FROM creator_pins
      WHERE creator_id = ${session.userId}
        AND item_id = ${itemId}
        AND item_type = ${itemType}
      LIMIT 1
    `;

    if (alreadyPinned.rows.length > 0) {
      return NextResponse.json(
        { error: "Item is already pinned" },
        { status: 409 }
      );
    }

    const insertResult = await sql<{ id: string }>`
      INSERT INTO creator_pins (creator_id, item_id, item_type, position)
      VALUES (${session.userId}, ${itemId}, ${itemType}, ${existingPins.rows.length})
      RETURNING id
    `;

    const orderedIds = existingPins.rows.map(row => row.id);
    const newPinId = insertResult.rows[0].id;
    const insertAt = clampPosition(requestedPosition, orderedIds.length);
    orderedIds.splice(insertAt, 0, newPinId);
    await normalisePositions(session.userId, orderedIds);

    return NextResponse.json(
      {
        id: newPinId,
        item_id: itemId,
        item_type: itemType,
        position: insertAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f/pinned] POST error:", error);
    return NextResponse.json(
      { error: "Failed to pin content" },
      { status: 500 }
    );
  }
}
