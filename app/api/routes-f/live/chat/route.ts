import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(60_000, 60); // 60 reads/min per IP

// ── GET /api/routes-f/live/chat?stream_id=&limit=50&cursor= ──────────────────
// Returns paginated chat history in reverse-chronological order (newest first).
// cursor = last message id from previous page (exclusive upper bound).
export async function GET(req: NextRequest) {
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

  const { searchParams } = req.nextUrl;
  const streamId = searchParams.get("stream_id");
  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const cursor = searchParams.get("cursor"); // message id cursor

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 100);

  try {
    // Resolve active stream session for this streamer
    const sessionResult = await sql`
      SELECT ss.id AS session_id
      FROM stream_sessions ss
      WHERE ss.user_id = ${streamId}
        AND ss.ended_at IS NULL
      ORDER BY ss.started_at DESC
      LIMIT 1
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { messages: [], nextCursor: null },
        { status: 200 }
      );
    }

    const sessionId = sessionResult.rows[0].session_id;
    const cursorId = cursor ? parseInt(cursor, 10) : null;

    const rows = await sql`
      SELECT
        cm.id,
        cm.username   AS sender_username,
        cm.content    AS body,
        cm.created_at AS sent_at,
        cm.is_deleted
      FROM chat_messages cm
      WHERE cm.stream_session_id = ${sessionId}
        AND (${cursorId}::int IS NULL OR cm.id < ${cursorId})
      ORDER BY cm.id DESC
      LIMIT ${limit}
    `;

    const messages = rows.rows.map(r => ({
      id: r.id,
      sender_username: r.sender_username,
      body: r.body,
      sent_at: r.sent_at,
      is_deleted: r.is_deleted,
    }));

    // Provide next cursor if there may be more pages
    const nextCursor =
      messages.length === limit
        ? String(messages[messages.length - 1].id)
        : null;

    return NextResponse.json({ messages, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("[chat:GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
