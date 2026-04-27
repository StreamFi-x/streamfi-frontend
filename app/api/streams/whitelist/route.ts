import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(60_000, 30);

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * GET  /api/streams/whitelist          – list the caller's whitelist entries
 * POST /api/streams/whitelist          – add a user (body: { identifier })
 * DELETE /api/streams/whitelist        – remove a user (body: { identifier })
 *
 * `identifier` can be a username or a Stellar wallet address (G...).
 *
 * Access check (for viewers):
 * GET /api/streams/whitelist/check?streamer=<username>
 *   → { allowed: boolean }
 */
export async function GET(req: NextRequest) {
  if (await isRateLimited(getIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Check endpoint: ?streamer=username
  const { searchParams } = new URL(req.url);
  const streamerUsername = searchParams.get("streamer");

  if (streamerUsername) {
    // Viewer checking their own access
    const session = await verifySession(req);
    if (!session.ok) return session.response;

    const { rows } = await sql`
      SELECT sw.id
      FROM stream_whitelist sw
      JOIN users streamer ON streamer.id = sw.streamer_id
      WHERE LOWER(streamer.username) = LOWER(${streamerUsername})
        AND (
          sw.user_id = ${session.userId}
          OR LOWER(sw.identifier) = LOWER(${session.username ?? ""})
          OR (${session.wallet} IS NOT NULL AND LOWER(sw.identifier) = LOWER(${session.wallet ?? ""}))
        )
      LIMIT 1
    `;
    return NextResponse.json({ allowed: rows.length > 0 });
  }

  // Streamer listing their own whitelist
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { rows } = await sql`
    SELECT
      sw.id,
      sw.identifier,
      sw.created_at,
      u.username,
      u.avatar
    FROM stream_whitelist sw
    LEFT JOIN users u ON u.id = sw.user_id
    WHERE sw.streamer_id = ${session.userId}
    ORDER BY sw.created_at DESC
  `;
  return NextResponse.json({ whitelist: rows });
}

export async function POST(req: NextRequest) {
  if (await isRateLimited(getIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { identifier } = await req.json().catch(() => ({}));
  if (!identifier || typeof identifier !== "string") {
    return NextResponse.json({ error: "identifier is required" }, { status: 400 });
  }

  const clean = identifier.trim();
  if (!clean) return NextResponse.json({ error: "identifier is required" }, { status: 400 });

  // Try to resolve to a user_id
  const isWallet = /^G[A-Z2-7]{55}$/.test(clean);
  const { rows: found } = isWallet
    ? await sql`SELECT id FROM users WHERE wallet = ${clean} LIMIT 1`
    : await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${clean}) LIMIT 1`;

  const resolvedUserId: string | null = found[0]?.id ?? null;

  // Prevent self-whitelisting
  if (resolvedUserId === session.userId) {
    return NextResponse.json({ error: "Cannot whitelist yourself" }, { status: 400 });
  }

  try {
    const { rows } = await sql`
      INSERT INTO stream_whitelist (streamer_id, user_id, identifier)
      VALUES (
        ${session.userId},
        ${resolvedUserId},
        ${clean}
      )
      ON CONFLICT DO NOTHING
      RETURNING id, identifier, created_at
    `;
    if (!rows.length) {
      return NextResponse.json({ error: "Already whitelisted" }, { status: 409 });
    }
    return NextResponse.json({ entry: { ...rows[0], username: found[0] ? clean : null } }, { status: 201 });
  } catch (err) {
    console.error("[whitelist] POST error:", err);
    return NextResponse.json({ error: "Failed to add to whitelist" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (await isRateLimited(getIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { identifier } = await req.json().catch(() => ({}));
  if (!identifier) return NextResponse.json({ error: "identifier is required" }, { status: 400 });

  const clean = identifier.trim();
  await sql`
    DELETE FROM stream_whitelist
    WHERE streamer_id = ${session.userId}
      AND (LOWER(identifier) = LOWER(${clean}) OR user_id = (
        SELECT id FROM users WHERE LOWER(username) = LOWER(${clean}) OR wallet = ${clean} LIMIT 1
      ))
  `;
  return NextResponse.json({ ok: true });
}
