import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureRoutesFSchema } from "../_lib/schema";

/**
 * VOD Comments endpoint.
 */

// GET /api/routes-f/comments?recording_id= — list comments sorted by timestamp
export async function GET(req: NextRequest) {
  try {
    await ensureRoutesFSchema();
    const { searchParams } = new URL(req.url);
    const recordingId = searchParams.get("recording_id");

    if (!recordingId) {
      return NextResponse.json(
        { error: "recording_id is required" },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      SELECT c.id, u.username, u.avatar, c.timestamp_seconds, c.body, c.created_at
      FROM vod_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.recording_id = ${recordingId}
      ORDER BY c.timestamp_seconds ASC
    `;

    return NextResponse.json({ comments: rows });
  } catch (error) {
    console.error("Comments GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/routes-f/comments — add a comment
export async function POST(req: NextRequest) {
  try {
    await ensureRoutesFSchema();
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    } // 401 for unauthenticated

    const { recording_id, timestamp_seconds, body } = await req.json();

    if (!recording_id || timestamp_seconds === undefined || !body) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check recording duration
    const rec = await sql`
      SELECT duration FROM stream_recordings WHERE id::text = ${recording_id} OR playback_id = ${recording_id}
      LIMIT 1
    `;

    if (rec.rows.length > 0 && timestamp_seconds > rec.rows[0].duration) {
      return NextResponse.json(
        { error: "Timestamp exceeds recording duration" },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      INSERT INTO vod_comments (user_id, recording_id, timestamp_seconds, body)
      VALUES (${session.userId}, ${recording_id}, ${timestamp_seconds}, ${body})
      RETURNING *
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Comments POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
