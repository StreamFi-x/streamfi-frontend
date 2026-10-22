import { isIP } from "node:net";
import { verifySession } from "@/lib/auth/verify-session";
import {
  mutateViewerTracking,
  type ViewerMutation,
} from "@/lib/stream/viewer-tracking";
import { getClientIp } from "@/lib/security/client-ip";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { ipToCountry } from "@/lib/geolocation/ip-to-country";
import {
  createViewerSession,
  verifyViewerSessionToken,
} from "@/lib/stream/viewer-session-token";

// The GET handler mints a fresh session per request — it must never be cached
// or every viewer would receive the same sessionId and collapse into one.
export const dynamic = "force-dynamic";

// Two limits cooperate here (#725): a coarse per-IP cap bounds abuse from a
// single origin across any stream, and a per-IP+stream cap bounds how fast one
// origin can inflate any single stream's counters. Neither is keyed by the
// client-chosen sessionId (which was the whole problem) — the per-stream key
// comes from the server-issued viewer token's `pid`.
const IP_WINDOW_MS = 60_000;
const IP_MAX_REQUESTS = 120;
const STREAM_MAX_REQUESTS = 60;

const isIpRateLimited = createRateLimiter(IP_WINDOW_MS, IP_MAX_REQUESTS);
const isStreamRateLimited = createRateLimiter(
  IP_WINDOW_MS,
  STREAM_MAX_REQUESTS
);

const RATE_LIMITED_RESPONSE = {
  error: "Too many requests",
} as const;

function clientIp(req: Request): string {
  return getClientIp(req.headers);
}

async function isRateLimited(
  ip: string,
  stream?: string | null
): Promise<boolean> {
  if (await isIpRateLimited(ip)) {
    return true;
  }
  if (stream && (await isStreamRateLimited(`${ip}|${stream}`))) {
    return true;
  }
  return false;
}

/**
 * Viewer token is accepted either in the JSON body (`token`) or the
 * `x-viewer-token` header. Body is the primary channel; the header keeps the
 * heartbeat path (which is a tiny JSON payload) convenient.
 */
function extractViewerToken(req: Request, body: unknown): unknown {
  const header = req.headers.get("x-viewer-token");
  if (header) {
    return header;
  }
  if (body && typeof body === "object" && "token" in body) {
    return (body as { token?: unknown }).token;
  }
  return undefined;
}

/**
 * GET /api/streams/viewers?playbackId=... (#725)
 *
 * Mints a viewer session for the stream. The returned `sessionId` is generated
 * server-side and signed into `token`; the client must present both on every
 * subsequent POST/PATCH/DELETE. Anonymous callers are allowed — this is not an
 * auth gate, it makes the session id unforgeable and tieable to one stream.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  if (await isRateLimited(ip)) {
    return NextResponse.json(RATE_LIMITED_RESPONSE, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const playbackId = new URL(req.url).searchParams.get("playbackId");
  if (!playbackId) {
    return NextResponse.json(
      { error: "Playback ID is required" },
      { status: 400 }
    );
  }

  try {
    const result = await sql`
      SELECT id
      FROM users
      WHERE mux_playback_id = ${playbackId}
        AND is_live = true
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Stream is not currently live" },
        { status: 404 }
      );
    }

    const session = createViewerSession(playbackId);
    return NextResponse.json(session, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Viewer session mint error:", error);
    return NextResponse.json(
      { error: "Failed to start viewer session" },
      { status: 500 }
    );
  }
}

async function mutate(req: NextRequest, action: ViewerMutation) {
  const ip = clientIp(req);
  if (await isRateLimited(ip)) {
    return NextResponse.json(RATE_LIMITED_RESPONSE, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { playbackId, sessionId } = body ?? {};
  if (
    typeof sessionId !== "string" ||
    !sessionId ||
    (action === "join" && (typeof playbackId !== "string" || !playbackId))
  ) {
    return NextResponse.json(
      { error: "Playback ID and session ID are required" },
      { status: 400 }
    );
  }
  const claims = verifyViewerSessionToken(extractViewerToken(req, body), {
    sessionId,
    ...(playbackId ? { playbackId } : {}),
  });
  if (!claims) {
    return NextResponse.json(
      { error: "A valid viewer session token is required" },
      { status: 401 }
    );
  }
  if (await isRateLimited(ip, claims.pid)) {
    return NextResponse.json(RATE_LIMITED_RESPONSE, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  try {
    let country: string | null = null;
    let viewerUserId: string | null = null;
    if (action === "join") {
      if (
        req.cookies.get("privy_session")?.value ||
        req.cookies.get("wallet_session")?.value
      ) {
        const viewer = await verifySession(req);
        if (viewer.ok) {
          viewerUserId = viewer.userId;
        }
      }
      const header =
        req.headers.get("cf-ipcountry") ||
        req.headers.get("x-vercel-ip-country");
      country =
        header && /^[a-z]{2}$/i.test(header) && header.toUpperCase() !== "XX"
          ? header.toUpperCase()
          : ((await ipToCountry(ip))?.country ?? null);
    }
    const snapshot = await mutateViewerTracking({
      playbackId: claims.pid,
      sessionId: claims.sid,
      action,
      viewerUserId,
      ip: isIP(ip) ? ip : null,
      country,
    });
    if (!snapshot && action === "join") {
      return NextResponse.json(
        { error: "Stream is not currently live or has no active session" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        message:
          action === "join"
            ? snapshot?.inserted
              ? "Viewer joined successfully"
              : "Already tracking this viewer"
            : action === "leave"
              ? "Viewer left successfully"
              : "Heartbeat recorded",
        ...(snapshot
          ? {
              currentViewers: snapshot.currentViewers,
              streamInfo: { username: snapshot.username, isLive: true },
            }
          : {}),
      },
      { status: action === "join" && snapshot?.inserted ? 201 : 200 }
    );
  } catch (error) {
    console.error("Viewer tracking unavailable:", error);
    return NextResponse.json(
      { error: "Viewer tracking temporarily unavailable" },
      {
        status: 503,
        headers: { "Retry-After": "5" },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  return mutate(req, "join");
}
export async function PATCH(req: NextRequest) {
  return mutate(req, "heartbeat");
}
export async function DELETE(req: NextRequest) {
  return mutate(req, "leave");
}
