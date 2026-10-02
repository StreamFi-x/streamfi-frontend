/**
 * GET /api/routes-f/auth-session-list
 *
 * Returns all active sessions for the currently authenticated user, with a
 * device hint and a SHA-256 hash of the session's IP address (never the raw
 * IP). The session that made this request is marked with `is_current: true`.
 *
 * This is a thin wrapper around lib/sessions/user-sessions.listActiveSessions
 * — the same query used by /api/routes-f/session — requesting hashed IPs
 * instead of that route's masked-for-display IPs.
 *
 * Response shape:
 * {
 *   "sessions": [
 *     {
 *       "id": "uuid",
 *       "device_hint": "Chrome on macOS",
 *       "ip_hash": "3f9c2b...e1",
 *       "last_seen_at": "2026-03-26T12:00:00Z",
 *       "created_at": "2026-03-25T08:00:00Z",
 *       "is_current": true
 *     }
 *   ]
 * }
 *
 * Error responses:
 *   401 — unauthorized (no valid session)
 *   429 — rate limited
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { extractRawToken } from "@/lib/sessions/extract-raw-token";
import { listActiveSessions } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";

// 30 requests per minute per IP — listing sessions is read-only but still bounded
const isRateLimited = createRateLimiter(60_000, 30);

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Rate limit
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

  // 2. Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // 3. Extract raw token to identify the current session
  const rawToken = extractRawToken(req);
  if (!rawToken) {
    // verifySession succeeded so a cookie must exist — guard anyway
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Fetch active sessions with hashed (not masked) IPs
  try {
    const sessions = await listActiveSessions(session.userId, rawToken, "hash");

    return NextResponse.json({
      sessions: sessions.map(({ ip_address, ...rest }) => ({
        ...rest,
        ip_hash: ip_address,
      })),
    });
  } catch (err) {
    console.error("[GET /api/routes-f/auth-session-list] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
