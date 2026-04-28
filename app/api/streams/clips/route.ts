import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(60_000, 10); // 10 clips/min per IP

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * GET  /api/streams/clips?username=foo&limit=20&offset=0
 *   → public list of ready clips for a streamer
 *
 * POST /api/streams/clips
 *   body: { streamer_username, start_offset, duration, title? }
 *   → creates a clip (30–60 s). Authenticated.
 *
 * DELETE /api/streams/clips?id=<clip_id>
 *   → clip owner or streamer can delete
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username") ?? "";
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  try {
    const { rows } = username
      ? await sql`
          SELECT
            c.id, c.title, c.playback_id, c.mux_asset_id,
            c.start_offset, c.duration, c.view_count, c.status, c.created_at,
            clipper.username AS clipped_by_username,
            clipper.avatar   AS clipped_by_avatar,
            streamer.username AS streamer_username
          FROM stream_clips c
          JOIN users clipper  ON clipper.id  = c.clipped_by
          JOIN users streamer ON streamer.id = c.streamer_id
          WHERE c.status = 'ready'
            AND LOWER(streamer.username) = LOWER(${username})
          ORDER BY c.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT
            c.id, c.title, c.playback_id, c.mux_asset_id,
            c.start_offset, c.duration, c.view_count, c.status, c.created_at,
            clipper.username AS clipped_by_username,
            clipper.avatar   AS clipped_by_avatar,
            streamer.username AS streamer_username
          FROM stream_clips c
          JOIN users clipper  ON clipper.id  = c.clipped_by
          JOIN users streamer ON streamer.id = c.streamer_id
          WHERE c.status = 'ready'
          ORDER BY c.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    const { rows: countRows } = username
      ? await sql`
          SELECT COUNT(*) AS total FROM stream_clips c
          JOIN users streamer ON streamer.id = c.streamer_id
          WHERE c.status = 'ready' AND LOWER(streamer.username) = LOWER(${username})
        `
      : await sql`SELECT COUNT(*) AS total FROM stream_clips WHERE status = 'ready'`;

    const total = parseInt(countRows[0].total, 10);
    return NextResponse.json(
      { clips: rows, total, hasMore: offset + limit < total },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("[clips] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (await isRateLimited(getIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const body = await req.json().catch(() => ({}));
  const { streamer_username, start_offset, duration, title } = body;

  if (!streamer_username) {
    return NextResponse.json({ error: "streamer_username is required" }, { status: 400 });
  }
  if (typeof start_offset !== "number" || start_offset < 0) {
    return NextResponse.json({ error: "start_offset must be a non-negative number" }, { status: 400 });
  }
  const clipDuration = typeof duration === "number" ? duration : 30;
  if (clipDuration < 1 || clipDuration > 60) {
    return NextResponse.json({ error: "duration must be between 1 and 60 seconds" }, { status: 400 });
  }

  // Resolve streamer
  const { rows: streamerRows } = await sql`
    SELECT id, mux_playback_id, is_live FROM users
    WHERE LOWER(username) = LOWER(${streamer_username})
    LIMIT 1
  `;
  if (!streamerRows.length) {
    return NextResponse.json({ error: "Streamer not found" }, { status: 404 });
  }
  const streamer = streamerRows[0];
  if (!streamer.is_live) {
    return NextResponse.json({ error: "Stream is not currently live" }, { status: 409 });
  }

  // Get current stream session
  const { rows: sessionRows } = await sql`
    SELECT id FROM stream_sessions
    WHERE user_id = ${streamer.id} AND ended_at IS NULL
    ORDER BY started_at DESC LIMIT 1
  `;
  const streamSessionId: string | null = sessionRows[0]?.id ?? null;

  try {
    const clipTitle = title?.trim() || `Clip by ${session.username ?? "viewer"}`;
    const { rows } = await sql`
      INSERT INTO stream_clips
        (stream_session_id, clipped_by, streamer_id, title, start_offset, duration, status)
      VALUES
        (${streamSessionId}, ${session.userId}, ${streamer.id}, ${clipTitle}, ${start_offset}, ${clipDuration}, 'processing')
      RETURNING id, title, start_offset, duration, status, created_at
    `;
    return NextResponse.json({ clip: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[clips] POST error:", err);
    return NextResponse.json({ error: "Failed to create clip" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const clipId = new URL(req.url).searchParams.get("id");
  if (!clipId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT id, clipped_by, streamer_id FROM stream_clips WHERE id = ${clipId} LIMIT 1
  `;
  if (!rows.length) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const clip = rows[0];
  if (clip.clipped_by !== session.userId && clip.streamer_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await sql`DELETE FROM stream_clips WHERE id = ${clipId}`;
  return NextResponse.json({ ok: true });
}
