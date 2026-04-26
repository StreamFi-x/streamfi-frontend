import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(60_000, 30);

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const VALID_QUALITY = ["auto", "1080p", "720p", "480p", "360p"] as const;
const VALID_THEME = ["dark", "light", "system"] as const;
const VALID_FONT_SIZE = ["small", "medium", "large"] as const;

/**
 * GET  /api/users/preferences  – fetch the caller's preferences (creates defaults if missing)
 * PATCH /api/users/preferences – update one or more preference fields
 */
export async function GET(req: NextRequest) {
  if (await isRateLimited(getIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await verifySession(req);
  if (!session.ok) return session.response;

  // Upsert defaults on first access
  const { rows } = await sql`
    INSERT INTO user_preferences (user_id)
    VALUES (${session.userId})
    ON CONFLICT (user_id) DO NOTHING
  `.then(() =>
    sql`SELECT * FROM user_preferences WHERE user_id = ${session.userId} LIMIT 1`
  );

  return NextResponse.json({ preferences: rows[0] ?? null });
}

export async function PATCH(req: NextRequest) {
  if (await isRateLimited(getIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const body = await req.json().catch(() => ({}));

  // Validate enum fields
  if (body.stream_quality !== undefined && !VALID_QUALITY.includes(body.stream_quality)) {
    return NextResponse.json({ error: `stream_quality must be one of: ${VALID_QUALITY.join(", ")}` }, { status: 400 });
  }
  if (body.theme !== undefined && !VALID_THEME.includes(body.theme)) {
    return NextResponse.json({ error: `theme must be one of: ${VALID_THEME.join(", ")}` }, { status: 400 });
  }
  if (body.chat_font_size !== undefined && !VALID_FONT_SIZE.includes(body.chat_font_size)) {
    return NextResponse.json({ error: `chat_font_size must be one of: ${VALID_FONT_SIZE.join(", ")}` }, { status: 400 });
  }

  // Ensure row exists
  await sql`INSERT INTO user_preferences (user_id) VALUES (${session.userId}) ON CONFLICT DO NOTHING`;

  const { rows } = await sql`
    UPDATE user_preferences SET
      stream_quality   = COALESCE(${body.stream_quality   ?? null}, stream_quality),
      notify_live      = COALESCE(${body.notify_live      ?? null}, notify_live),
      notify_clips     = COALESCE(${body.notify_clips     ?? null}, notify_clips),
      notify_tips      = COALESCE(${body.notify_tips      ?? null}, notify_tips),
      theme            = COALESCE(${body.theme            ?? null}, theme),
      language         = COALESCE(${body.language         ?? null}, language),
      chat_font_size   = COALESCE(${body.chat_font_size   ?? null}, chat_font_size),
      show_timestamps  = COALESCE(${body.show_timestamps  ?? null}, show_timestamps),
      updated_at       = CURRENT_TIMESTAMP
    WHERE user_id = ${session.userId}
    RETURNING *
  `;

  return NextResponse.json({ preferences: rows[0] });
}
