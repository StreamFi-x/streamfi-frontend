import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";

// ── Constants ─────────────────────────────────────────────────────────────────
const VIEWER_TTL_MS = 60_000; // expire after 60s of no heartbeat
const HEARTBEAT_RATE_LIMIT = createRateLimiter(30_000, 5); // 5 pings per 30s per IP

// ── In-memory presence store ──────────────────────────────────────────────────
// Maps stream_id → Map<session_id, ViewerEntry>
// Ephemeral by design — resets on cold start, which is acceptable for live counts.

interface ViewerEntry {
  sessionId: string;
  userId: string | null; // null = anonymous
  username: string | null;
  lastSeen: number; // Date.now()
  hideFromList: boolean; // user opted out of viewer list
}

const presenceStore = new Map<string, Map<string, ViewerEntry>>();

/** Remove stale entries for a given stream and return the live map. */
function evict(streamId: string): Map<string, ViewerEntry> {
  const viewers = presenceStore.get(streamId) ?? new Map<string, ViewerEntry>();
  const now = Date.now();
  for (const [sid, entry] of viewers) {
    if (now - entry.lastSeen > VIEWER_TTL_MS) viewers.delete(sid);
  }
  presenceStore.set(streamId, viewers);
  return viewers;
}

// ── GET /api/routes-f/live/viewers?stream_id= ─────────────────────────────────
// Returns viewer count + authenticated viewer list (privacy-respecting).
export async function GET(req: NextRequest) {
  const streamId = req.nextUrl.searchParams.get("stream_id");
  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  // Verify the stream exists and is live
  try {
    const { rows } = await sql`
      SELECT id, is_live FROM users WHERE id = ${streamId} LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }
    if (!rows[0].is_live) {
      return NextResponse.json(
        { error: "Stream is not live" },
        { status: 409 }
      );
    }
  } catch (err) {
    console.error("[viewers:GET] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  const viewers = evict(streamId);
  const viewerCount = viewers.size;

  // Authenticated viewers who haven't opted out
  const authenticatedViewers = Array.from(viewers.values())
    .filter(v => v.userId !== null && !v.hideFromList)
    .map(v => ({ userId: v.userId, username: v.username }));

  return NextResponse.json(
    { viewerCount, authenticatedViewers },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// ── POST /api/routes-f/live/viewers/heartbeat ─────────────────────────────────
// Viewer pings to maintain presence. Auth is optional — anonymous viewers are
// tracked by session_id only.
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await HEARTBEAT_RATE_LIMIT(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "30" } }
    );
  }

  let body: { stream_id?: string; session_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stream_id, session_id } = body;
  if (!stream_id || !session_id) {
    return NextResponse.json(
      { error: "stream_id and session_id are required" },
      { status: 400 }
    );
  }

  // Verify stream is live
  try {
    const { rows } = await sql`
      SELECT id, is_live FROM users WHERE id = ${stream_id} LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }
    if (!rows[0].is_live) {
      return NextResponse.json(
        { error: "Stream is not live" },
        { status: 409 }
      );
    }
  } catch (err) {
    console.error("[viewers:POST] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  // Resolve authenticated viewer (optional — anonymous viewers are fine)
  let userId: string | null = null;
  let username: string | null = null;
  let hideFromList = false;

  const session = await verifySession(req);
  if (session.ok) {
    userId = session.userId;
    username = session.username;

    // Check opt-out preference — best-effort, don't block on failure
    try {
      const { rows } = await sql`
        SELECT hide_from_viewer_list FROM users WHERE id = ${userId} LIMIT 1
      `;
      hideFromList = rows[0]?.hide_from_viewer_list ?? false;
    } catch {
      // Column may not exist yet — default to visible
    }
  }

  const viewers = evict(stream_id);
  viewers.set(session_id, {
    sessionId: session_id,
    userId,
    username,
    lastSeen: Date.now(),
    hideFromList,
  });
  presenceStore.set(stream_id, viewers);

  return NextResponse.json(
    { ok: true, viewerCount: viewers.size },
    { status: 200 }
  );
}
