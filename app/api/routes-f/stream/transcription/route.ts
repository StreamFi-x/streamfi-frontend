import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(60_000, 20); // 20 req/min per IP

// ── GET /api/routes-f/stream/transcription?recording_id= ─────────────────────
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const recordingId = new URL(req.url).searchParams.get("recording_id");
  if (!recordingId) {
    return NextResponse.json(
      { error: "recording_id query param is required" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT
        tj.id,
        tj.status,
        tj.error_reason,
        tj.recording_id,
        tj.user_id,
        CASE WHEN tj.status = 'ready' THEN tj.content ELSE NULL END AS content
      FROM transcription_jobs tj
      WHERE tj.recording_id = ${recordingId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Transcription job not found" },
        { status: 404 }
      );
    }

    const job = rows[0];

    // Only the owner can view transcription details
    if (job.user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      status: job.status,
      recording_id: job.recording_id,
      ...(job.status === "ready" && { content: job.content }),
      ...(job.status === "failed" && { error_reason: job.error_reason }),
    });
  } catch (err) {
    console.error("[transcription GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch transcription" },
      { status: 500 }
    );
  }
}

// ── POST /api/routes-f/stream/transcription ───────────────────────────────────
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

  const session = await verifySession(req);
  if (!session.ok) return session.response;

  let body: { recording_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { recording_id } = body;
  if (!recording_id) {
    return NextResponse.json(
      { error: "recording_id is required" },
      { status: 400 }
    );
  }

  try {
    // Verify the recording exists and the authenticated user owns it
    const { rows: recRows } = await sql`
      SELECT id, user_id, status
      FROM stream_recordings
      WHERE id = ${recording_id}
      LIMIT 1
    `;

    if (recRows.length === 0) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    const recording = recRows[0];

    if (recording.user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (recording.status !== "ready") {
      return NextResponse.json(
        { error: "Recording is not ready for transcription" },
        { status: 409 }
      );
    }

    // Upsert: one round-trip — returns existing job or inserts new one
    const { rows: inserted } = await sql`
      INSERT INTO transcription_jobs (recording_id, user_id, status)
      VALUES (${recording_id}, ${session.userId}, 'pending')
      ON CONFLICT (recording_id) DO UPDATE SET updated_at = NOW()
      RETURNING id, status
    `;

    const job = inserted[0];

    return NextResponse.json(
      { job_id: job.id, status: job.status },
      { status: 202 }
    );
  } catch (err) {
    console.error("[transcription POST]", err);
    return NextResponse.json(
      { error: "Failed to create transcription job" },
      { status: 500 }
    );
  }
}
