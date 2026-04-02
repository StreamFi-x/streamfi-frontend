/**
 * POST /api/routes-f/vod/chapters/import
 * Bulk-import chapter markers from a live stream into a VOD recording.
 *
 * Body: { recording_id: string, stream_id: string }
 *
 * Copies all chapters from stream_chapters where stream_id matches,
 * up to the per-recording cap of 100. Auth required; caller must own
 * the recording.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/auth/verify-session";

const isIpRateLimited = createRateLimiter(60_000, 5);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_CHAPTERS_PER_RECORDING = 100;

async function ensureTables(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vod_chapters (
      id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      recording_id      VARCHAR      NOT NULL,
      title             VARCHAR(255) NOT NULL,
      timestamp_seconds INTEGER      NOT NULL,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS stream_chapters (
      id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id         VARCHAR      NOT NULL,
      title             VARCHAR(255) NOT NULL,
      timestamp_seconds INTEGER      NOT NULL,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

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

  const { recording_id, stream_id } = body as Record<string, unknown>;

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
  if (typeof stream_id !== "string" || !stream_id) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(stream_id)) {
    return NextResponse.json(
      { error: "Invalid stream_id format" },
      { status: 400 }
    );
  }

  try {
    await ensureTables();

    // Verify recording exists and caller owns it
    const { rows: recordings } = await sql`
      SELECT id, user_id FROM stream_recordings WHERE id = ${recording_id} LIMIT 1
    `;

    if (recordings.length === 0) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    if (recordings[0].user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch source chapters ordered by timestamp
    const { rows: sourceChapters } = await sql`
      SELECT title, timestamp_seconds
      FROM stream_chapters
      WHERE stream_id = ${stream_id}
      ORDER BY timestamp_seconds ASC
    `;

    if (sourceChapters.length === 0) {
      return NextResponse.json({
        imported: 0,
        truncated: false,
        message: "No chapters found for the specified stream",
      });
    }

    // Determine how many slots remain under the cap
    const { rows: countRows } = await sql`
      SELECT COUNT(*) AS count FROM vod_chapters WHERE recording_id = ${recording_id}
    `;
    const existingCount = parseInt(countRows[0].count, 10);
    const available = MAX_CHAPTERS_PER_RECORDING - existingCount;

    if (available <= 0) {
      return NextResponse.json(
        {
          error: `Maximum of ${MAX_CHAPTERS_PER_RECORDING} chapters per recording already reached`,
        },
        { status: 422 }
      );
    }

    const chaptersToImport = sourceChapters.slice(0, available);
    const truncated = sourceChapters.length > available;

    for (const ch of chaptersToImport) {
      await sql`
        INSERT INTO vod_chapters (recording_id, title, timestamp_seconds)
        VALUES (${recording_id}, ${ch.title}, ${ch.timestamp_seconds})
      `;
    }

    return NextResponse.json({
      imported: chaptersToImport.length,
      truncated,
      message: `Successfully imported ${chaptersToImport.length} chapter${chaptersToImport.length !== 1 ? "s" : ""}`,
    });
  } catch (err) {
    console.error("[vod/chapters/import] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
