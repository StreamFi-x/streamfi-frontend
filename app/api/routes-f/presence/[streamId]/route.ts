import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// DB schema (apply via migration):
//
// ALTER TABLE stream_recordings ADD COLUMN IF NOT EXISTS peak_viewers INT DEFAULT 0;
// ---------------------------------------------------------------------------
//
// Redis storage model:
//   Key:   presence:{streamId}     — Sorted Set
//   Score: Unix timestamp (last heartbeat)
//   Member: viewerId or anonymousId
//
// Heartbeat flow:
//   ZADD presence:{streamId} {now} {viewerId}
//   ZREMRANGEBYSCORE presence:{streamId} -inf {now - 60}   (expire stale > 60s)
//   ZCOUNT presence:{streamId} {now - 60} +inf             (current count)
// ---------------------------------------------------------------------------

import { redis } from "@/lib/redis";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

function presenceKey(streamId: string) {
  return `presence:${streamId}`;
}

function peakKey(streamId: string) {
  return `presence:${streamId}:peak`;
}

/**
 * GET /api/routes-f/presence/[streamId]
 * Returns current live viewer count and all-time peak for this stream.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { streamId: string } }
) {
  const { streamId } = params;
  const now = Math.floor(Date.now() / 1000);
  const staleThreshold = now - 60;

  const key = presenceKey(streamId);

  // Count viewers whose last heartbeat was within the last 60 seconds
  const count = await redis.zcount(key, staleThreshold, "+inf");

  // Fetch peak from Postgres
  const { rows } = await db.query(
    `SELECT peak_viewers FROM stream_recordings WHERE stream_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [streamId]
  );
  const peak = rows[0]?.peak_viewers ?? count;

  return NextResponse.json({ count, peak });
}

/**
 * POST /api/routes-f/presence/[streamId]
 * Body must include { viewer_id: string } — UUID for authed users, session ID for anon.
 * Also used for explicit leave when action=leave is in the query string.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { streamId: string } }
) {
  const { streamId } = params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action"); // 'heartbeat' | 'leave'

  const body = await req.json().catch(() => ({}));
  const user = await getAuthUser(req);

  // Use authenticated user ID if available, otherwise fall back to provided anonymous ID
  const viewerId: string | undefined =
    user?.id ?? body.viewer_id ?? body.anonymous_id;

  if (!viewerId) {
    return NextResponse.json(
      { error: "viewer_id or anonymous_id is required" },
      { status: 400 }
    );
  }

  const key = presenceKey(streamId);
  const now = Math.floor(Date.now() / 1000);
  const staleThreshold = now - 60;

  // --- Explicit leave ---
  if (action === "leave") {
    await redis.zrem(key, viewerId);
    return NextResponse.json({ success: true });
  }

  // --- Heartbeat (default) ---
  // 1. Upsert viewer with current timestamp
  await redis.zadd(key, now, viewerId);

  // 2. Expire stale viewers (> 60s without a heartbeat)
  await redis.zremrangebyscore(key, "-inf", staleThreshold);

  // 3. Current live count
  const count = await redis.zcount(key, staleThreshold, "+inf");

  // 4. Update peak in Postgres if current count exceeds stored peak
  const { rows } = await db.query(
    `SELECT peak_viewers FROM stream_recordings WHERE stream_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [streamId]
  );

  const currentPeak = rows[0]?.peak_viewers ?? 0;
  if (count > currentPeak) {
    await db.query(
      `UPDATE stream_recordings SET peak_viewers = $1 WHERE stream_id = $2`,
      [count, streamId]
    );
  }

  return NextResponse.json({ count });
}
