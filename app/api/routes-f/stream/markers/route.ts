import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

/**
 * GET /api/routes-f/stream/markers?recording_id= — list own bookmarks for a recording
 * POST /api/routes-f/stream/markers — add a bookmark (recording_id, timestamp_seconds, note?)
 */

async function ensureTableExists() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_markers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      recording_id VARCHAR(255) NOT NULL,
      timestamp_seconds INTEGER NOT NULL,
      note VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_markers_user_recording ON stream_markers(user_id, recording_id);
  `;
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { searchParams } = new URL(req.url);
  const recordingId = searchParams.get("recording_id");

  if (!recordingId) {
    return NextResponse.json(
      { error: "recording_id is required" },
      { status: 400 }
    );
  }

  try {
    await ensureTableExists();
    const { rows } = await sql`
      SELECT id, recording_id, timestamp_seconds, note, created_at
      FROM stream_markers
      WHERE user_id = ${session.userId} AND recording_id = ${recordingId}
      ORDER BY timestamp_seconds ASC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[GET Markers] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch markers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  try {
    const { recording_id, timestamp_seconds, note } = await req.json();

    if (!recording_id || typeof timestamp_seconds !== "number") {
      return NextResponse.json(
        { error: "recording_id and timestamp_seconds are required" },
        { status: 400 }
      );
    }

    if (note && note.length > 100) {
      return NextResponse.json(
        { error: "Note must be 100 characters or less" },
        { status: 400 }
      );
    }

    await ensureTableExists();

    // Check limit: Max 50 bookmarks per recording per user
    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int as count 
      FROM stream_markers 
      WHERE user_id = ${session.userId} AND recording_id = ${recording_id}
    `;

    if (countRows[0].count >= 50) {
      return NextResponse.json(
        { error: "Maximum 50 bookmarks per recording reached" },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      INSERT INTO stream_markers (user_id, recording_id, timestamp_seconds, note)
      VALUES (${session.userId}, ${recording_id}, ${timestamp_seconds}, ${note || null})
      RETURNING id, recording_id, timestamp_seconds, note, created_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[POST Markers] Error:", error);
    return NextResponse.json(
      { error: "Failed to add marker" },
      { status: 500 }
    );
  }
}
