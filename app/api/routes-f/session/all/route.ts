/**
 * DELETE /api/routes-f/session/all
 *
 * Revokes all active sessions for the authenticated user EXCEPT the current one.
 * This is the "sign out of all other devices" action.
 *
 * The current session (identified by the request cookie) is preserved so the
 * user remains logged in on the device they used to trigger this action.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { extractRawToken } from "@/lib/sessions/extract-raw-token";
import { revokeAllOtherSessions } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";

// 10 bulk-revocations per 10 minutes per IP — this is a sensitive action
const isRateLimited = createRateLimiter(10 * 60_000, 10);

export async function DELETE(req: NextRequest) {
  // 1. Rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  // 2. Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // 3. Extract raw token to identify (and preserve) the current session
  const rawToken = extractRawToken(req);
  if (!rawToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Revoke all other sessions
  try {
    const count = await revokeAllOtherSessions(session.userId, rawToken);
    return NextResponse.json({ ok: true, revoked: count });
  } catch (err) {
    console.error("[DELETE /api/routes-f/session/all] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
