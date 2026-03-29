/**
 * GET  /api/routes-f/vod/chapters?recording_id= — list chapters for a VOD
 * POST /api/routes-f/vod/chapters               — add a chapter marker
 *
 * Constraints:
 *   - POST requires session auth; caller must own the recording
 *   - timestamp_seconds must be >= 0 and within the recording's duration
 *   - Max 100 chapters per recording
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/auth/verify-session";

const isIpRateLimited = createRateLimiter(60_000, 5);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_CHAPTERS_PER_RECORDING = 100;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function ensureChaptersTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vod_chapters (
      id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      recording_id      VARCHAR      NOT NULL,
      title             VARCHAR(255) NOT NULL,
      timestamp_seconds INTEGER      NOT NULL,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
}

// ── GET /api/routes-f/vod/chapters?recording_id= ────────────────────────────

export async function GET(req: NextRequest) {
  const ip = getIp(req);
  if (await isIpRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = new URL(req.url);
  const recordingId = searchParams.get("recording_id");

  if (!recordingId) {
    return NextResponse.json(
      { error: "recording_id is required" },
      { status: 400 }
    );
  }

  if (!UUID_RE.test(recordingId)) {
    return NextResponse.json(
      { error: "Invalid recording_id format" },
      { status: 400 }
    );
  }

  try {
    await ensureChaptersTable();

    const { rows: recordings } = await sql`
      SELECT id FROM stream_recordings WHERE id = ${recordingId} LIMIT 1
    `;

    if (recordings.length === 0) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    const { rows } = await sql`
      SELECT id, recording_id, title, timestamp_seconds, created_at
      FROM vod_chapters
      WHERE recording_id = ${recordingId}
      ORDER BY timestamp_seconds ASC
    `;

    return NextResponse.json({ chapters: rows });
  } catch (err) {
    console.error("[vod/chapters] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── POST /api/routes-f/vod/chapters ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (await isIpRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const { recording_id, title, timestamp_seconds } = body as Record<
    string,
    unknown
  >;

  if (typeof recording_id !== "string" || !recording_id) {
    return NextResponse.json(
      { error: "recording_id is required" },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(recording_id)) {
    return NextResponse.json(
      { error: "Invalid recording_id format" },
      { status: 400 }
    );
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json(
      { error: "title is required and must be a non-empty string" },
      { status: 400 }
    );
  }
  if (
    typeof timestamp_seconds !== "number" ||
    !Number.isInteger(timestamp_seconds) ||
    timestamp_seconds < 0
  ) {
    return NextResponse.json(
      { error: "timestamp_seconds must be a non-negative integer" },
      { status: 400 }
    );
  }

  try {
    await ensureChaptersTable();

    // Verify recording exists and caller owns it; fetch duration for validation
    const { rows: recordings } = await sql`
      SELECT id, duration, user_id FROM stream_recordings
      WHERE id = ${recording_id}
      LIMIT 1
    `;

    if (recordings.length === 0) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    const recording = recordings[0];

    if (recording.user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate timestamp is within recording duration
    const duration =
      typeof recording.duration === "number"
        ? recording.duration
        : parseFloat(recording.duration);
    if (!isNaN(duration) && timestamp_seconds > Math.floor(duration)) {
      return NextResponse.json(
        {
          error: `timestamp_seconds (${timestamp_seconds}) exceeds recording duration (${Math.floor(duration)}s)`,
        },
        { status: 422 }
      );
    }

    // Enforce chapter cap
    const { rows: countRows } = await sql`
      SELECT COUNT(*) AS count FROM vod_chapters WHERE recording_id = ${recording_id}
    `;
    const currentCount = parseInt(countRows[0].count, 10);
    if (currentCount >= MAX_CHAPTERS_PER_RECORDING) {
      return NextResponse.json(
        {
          error: `Maximum of ${MAX_CHAPTERS_PER_RECORDING} chapters per recording reached`,
        },
        { status: 422 }
      );
    }

    const { rows } = await sql`
      INSERT INTO vod_chapters (recording_id, title, timestamp_seconds)
      VALUES (${recording_id}, ${title.trim()}, ${timestamp_seconds})
      RETURNING id, recording_id, title, timestamp_seconds, created_at
    `;

    return NextResponse.json({ chapter: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[vod/chapters] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
