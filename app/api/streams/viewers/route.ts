import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";

// 60 viewer join/leave events per minute per IP prevents count inflation attacks
const isRateLimited = createRateLimiter(60_000, 60);

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  try {
    const { playbackId, sessionId, userId } = await req.json();

    if (!playbackId || !sessionId) {
      return NextResponse.json(
        { error: "Playback ID and session ID are required" },
        { status: 400 }
      );
    }

    // Single query: fetch stream + active session together
    const result = await sql`
      SELECT
        u.id,
        u.username,
        u.is_live,
        ss.id AS session_id
      FROM users u
      LEFT JOIN stream_sessions ss
        ON u.id = ss.user_id AND ss.ended_at IS NULL
      WHERE u.mux_playback_id = ${playbackId}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const stream = result.rows[0];

    if (!stream.is_live) {
      return NextResponse.json({ error: "Stream is not currently live" }, { status: 409 });
    }

    // --- Deduplicate: check if this viewer session is already counted ---
    // Wrapped in try/catch so a missing stream_viewers table never blocks the count.
    let alreadyCounted = false;
    try {
      const existingViewer = await sql`
        SELECT id FROM stream_viewers
        WHERE session_id = ${sessionId} AND left_at IS NULL
      `;
      if (existingViewer.rows.length > 0) {
        return NextResponse.json({ message: "Already tracking this viewer" }, { status: 200 });
      }
    } catch {
      // stream_viewers table may not exist yet — skip dedup, still count viewer
    }

    // --- Core: always increment current_viewers on the users row ---
    const updated = await sql`
      UPDATE users SET
        current_viewers = current_viewers + 1,
        total_views     = total_views + 1,
        updated_at      = CURRENT_TIMESTAMP
      WHERE id = ${stream.id}
      RETURNING current_viewers
    `;
    const newViewerCount = updated.rows[0].current_viewers;

    // --- Best-effort session analytics (stream_viewers + stream_sessions) ---
    // These fail silently if the tables don't exist or session record is missing.
    if (stream.session_id && !alreadyCounted) {
      try {
        await sql`
          INSERT INTO stream_viewers (stream_session_id, user_id, session_id, joined_at)
          VALUES (${stream.session_id}, ${userId ?? null}, ${sessionId}, CURRENT_TIMESTAMP)
        `;
        await sql`
          UPDATE stream_sessions SET
            peak_viewers         = GREATEST(peak_viewers, ${newViewerCount}),
            total_unique_viewers = total_unique_viewers + 1
          WHERE id = ${stream.session_id}
        `;
      } catch {
        // Analytics tables missing or schema mismatch — viewer count is already updated above
      }
    }

    return NextResponse.json(
      {
        message: "Viewer joined successfully",
        currentViewers: newViewerCount,
        streamInfo: { username: stream.username, isLive: stream.is_live },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Viewer join error:", error);
    return NextResponse.json({ error: "Failed to join stream" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { sessionId, playbackId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // --- Primary path: stream_viewers record exists ---
    try {
      const viewerResult = await sql`
        UPDATE stream_viewers SET left_at = CURRENT_TIMESTAMP
        WHERE session_id = ${sessionId} AND left_at IS NULL
        RETURNING stream_session_id
      `;

      if (viewerResult.rows.length > 0) {
        const streamSessionId = viewerResult.rows[0].stream_session_id;
        const sessionResult = await sql`
          SELECT user_id FROM stream_sessions WHERE id = ${streamSessionId}
        `;
        if (sessionResult.rows.length > 0) {
          await sql`
            UPDATE users SET
              current_viewers = GREATEST(current_viewers - 1, 0),
              updated_at      = CURRENT_TIMESTAMP
            WHERE id = ${sessionResult.rows[0].user_id}
          `;
        }
        return NextResponse.json({ message: "Viewer left successfully" }, { status: 200 });
      }
    } catch {
      // stream_viewers or stream_sessions table missing — fall through to playbackId path
    }

    // --- Fallback path: use playbackId to decrement directly ---
    if (playbackId) {
      await sql`
        UPDATE users SET
          current_viewers = GREATEST(current_viewers - 1, 0),
          updated_at      = CURRENT_TIMESTAMP
        WHERE mux_playback_id = ${playbackId} AND current_viewers > 0
      `;
    }

    return NextResponse.json({ message: "Viewer left successfully" }, { status: 200 });
  } catch (error) {
    console.error("Viewer leave error:", error);
    return NextResponse.json({ error: "Failed to leave stream" }, { status: 500 });
  }
}
