import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

/**
 * POST /api/routes-f/history/[streamId]/track
 * Records or updates a watch session.
 * Body: { stream_type, streamer_username, seconds_watched }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { userId } = session;
  const { streamId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { stream_type, streamer_username, seconds_watched } = body;

  if (
    !stream_type ||
    !streamer_username ||
    typeof seconds_watched !== "number"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid required fields" },
      { status: 400 }
    );
  }

  try {
    // 1. Resolve streamer ID and current title
    const streamerResult = await sql`
      SELECT id, creator->>'streamTitle' as current_title
      FROM users
      WHERE LOWER(username) = LOWER(${streamer_username})
      LIMIT 1
    `;

    if (streamerResult.rows.length === 0) {
      return NextResponse.json({ error: "Streamer not found" }, { status: 404 });
    }

    const streamer = streamerResult.rows[0];
    const streamerId = streamer.id;

    // 2. Resolve final stream_id (null for live) and title
    const isLive = streamId === "live" || stream_type === "live";
    const finalStreamId = isLive ? null : streamId;

    let streamTitle = "Untitled Stream";
    let duration = 0;

    if (isLive) {
      streamTitle = streamer.current_title || "Live Stream";
    } else {
      // Look up recording title if available
      const recordingResult = await sql`
        SELECT title, duration 
        FROM stream_recordings 
        WHERE id::text = ${finalStreamId} 
           OR mux_asset_id = ${finalStreamId}
           OR playback_id = ${finalStreamId}
        LIMIT 1
      `;
      if (recordingResult.rows.length > 0) {
        streamTitle = recordingResult.rows[0].title || "Untitled Recording";
        duration = recordingResult.rows[0].duration || 0;
      }
    }

    // 3. Upsert watch history entry
    // Since NULLs in UNIQUE constraints can be tricky, we use a manual check-then-upsert logic
    // to ensure we always update the existing session if it matches.
    const existing = await sql`
      SELECT id, watch_seconds FROM watch_history
      WHERE viewer_id = ${userId}
        AND streamer_id = ${streamerId}
        AND stream_type = ${stream_type}
        AND (
          (stream_id IS NULL AND ${finalStreamId} IS NULL) OR
          (stream_id = ${finalStreamId})
        )
      LIMIT 1
    `;

    if (existing.rows.length > 0) {
      const newWatchSeconds = existing.rows[0].watch_seconds + seconds_watched;
      // Simple completion logic: if VOD and watched > 90% of duration
      const isCompleted = !isLive && duration > 0 && newWatchSeconds >= duration * 0.9;

      await sql`
        UPDATE watch_history
        SET watch_seconds = ${newWatchSeconds},
            last_seen_at = now(),
            stream_title = ${streamTitle},
            completed = ${isCompleted}
        WHERE id = ${existing.rows[0].id}
      `;
    } else {
      const isCompleted = !isLive && duration > 0 && seconds_watched >= duration * 0.9;
      
      await sql`
        INSERT INTO watch_history (
          viewer_id, streamer_id, stream_type, stream_id, stream_title, watch_seconds, last_seen_at, completed
        ) VALUES (
          ${userId}, ${streamerId}, ${stream_type}, ${finalStreamId}, ${streamTitle}, ${seconds_watched}, now(), ${isCompleted}
        )
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[history-track] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
