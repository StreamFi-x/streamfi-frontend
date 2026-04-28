import { NextRequest, NextResponse } from "next/server";

// Re-use the same stores defined in the parent route module via a shared singleton.
// For a full-stack implementation these would be Redis sorted set operations.

declare global {
  // eslint-disable-next-line no-var
  var __streamfi_presence: Map<string, Map<string, { lastSeen: number }>>;
  // eslint-disable-next-line no-var
  var __streamfi_peak: Map<string, number>;
}

globalThis.__streamfi_presence ??= new Map();
globalThis.__streamfi_peak ??= new Map();

const STALE_THRESHOLD_MS = 60_000;

function getOrCreate(streamId: string) {
  if (!globalThis.__streamfi_presence.has(streamId)) {
    globalThis.__streamfi_presence.set(streamId, new Map());
  }
  return globalThis.__streamfi_presence.get(streamId)!;
}

// ---------------------------------------------------------------------------
// POST /api/routes-f/presence/[streamId]/heartbeat
// Body: { viewer_id: string }   (anonymous viewers pass a session-scoped ID)
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ streamId: string }> }
) {
  const { streamId } = await context.params;

  let body: { viewer_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const viewerId = body.viewer_id;
  if (!viewerId || typeof viewerId !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required." },
      { status: 400 }
    );
  }

  const now = Date.now();
  const viewers = getOrCreate(streamId);

  // ZADD presence:{streamId} {now} {viewerId}  — update heartbeat
  viewers.set(viewerId, { lastSeen: now });

  // ZREMRANGEBYSCORE presence:{streamId} -inf {now - 60s}  — prune stale
  const cutoff = now - STALE_THRESHOLD_MS;
  for (const [id, entry] of viewers.entries()) {
    if (entry.lastSeen < cutoff) viewers.delete(id);
  }

  // ZCOUNT  — count active
  let count = 0;
  for (const entry of viewers.values()) {
    if (entry.lastSeen >= now - STALE_THRESHOLD_MS) count++;
  }

  // Update peak (mirrors Postgres ALTER TABLE stream_recordings peak_viewers)
  const existingPeak = globalThis.__streamfi_peak.get(streamId) ?? 0;
  if (count > existingPeak) {
    globalThis.__streamfi_peak.set(streamId, count);
  }

  return NextResponse.json({ count }, { status: 200 });
}
