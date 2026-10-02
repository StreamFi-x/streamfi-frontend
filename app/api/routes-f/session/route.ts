/**
 * GET /api/routes-f/session
 *
 * Returns all active sessions for the authenticated user.
 * The session that made this request is marked with `is_current: true`.
 *
 * Response shape:
 * {
 *   "sessions": [
 *     {
 *       "id": "uuid",
 *       "device_hint": "Chrome on macOS",
 *       "ip_address": "1.2.3.x",
 *       "last_seen_at": "2026-03-26T12:00:00Z",
 *       "created_at": "2026-03-25T08:00:00Z",
 *       "is_current": true
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { extractRawToken } from "@/lib/sessions/extract-raw-token";
import { listActiveSessions } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";

// 30 requests per minute per IP — listing sessions is read-only but still bounded
const isRateLimited = createRateLimiter(60_000, 30);

export async function GET(req: NextRequest) {
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

  // 4. Fetch active sessions
  try {
    const sessions = await listActiveSessions(session.userId, rawToken);
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[GET /api/routes-f/session] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
