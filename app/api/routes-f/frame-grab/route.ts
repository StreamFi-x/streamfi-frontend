import { NextRequest, NextResponse } from "next/server";

const SEED_CLIPS: Record<string, { duration_seconds: number }> = {
  "clip-001": { duration_seconds: 120 },
  "clip-002": { duration_seconds: 300 },
  "clip-003": { duration_seconds: 60 },
  "clip-004": { duration_seconds: 600 },
  "clip-005": { duration_seconds: 90 },
};

function getClipDuration(clipId: string): number {
  if (SEED_CLIPS[clipId]) return SEED_CLIPS[clipId].duration_seconds;
  // Deterministic fallback for unknown clip ids.
  const hash = clipId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 60 + (hash % 540);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  const clipId = typeof payload.clip_id === "string" ? payload.clip_id.trim() : null;
  if (!clipId) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  const playbackId = typeof payload.playback_id === "string" ? payload.playback_id.trim() : null;
  if (!playbackId) {
    return NextResponse.json({ error: "playback_id is required" }, { status: 400 });
  }

  const rawTime = payload.time_seconds;
  if (rawTime === undefined || rawTime === null) {
    return NextResponse.json({ error: "time_seconds is required" }, { status: 400 });
  }
  const timeSeconds = typeof rawTime === "number" ? rawTime : Number(rawTime);
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    return NextResponse.json(
      { error: "time_seconds must be a non-negative number" },
      { status: 400 },
    );
  }

  const duration = getClipDuration(clipId);
  if (timeSeconds > duration) {
    return NextResponse.json(
      {
        error: `time_seconds (${timeSeconds}) exceeds clip duration (${duration}s)`,
        clip_duration_seconds: duration,
      },
      { status: 422 },
    );
  }

  const frameUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${timeSeconds}`;
  return NextResponse.json({ frame_url: frameUrl, clip_id: clipId, time_seconds: timeSeconds });
}
