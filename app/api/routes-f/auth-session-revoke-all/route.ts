/**
 * DELETE /api/routes-f/auth-session-revoke-all
 *
 * Revokes every active session for the current user except the one making
 * this request, so a compromised device is cut off without logging the
 * caller themselves out.
 *
 * Response shape:
 * { "revokedCount": 3 }
 *
 * Error responses:
 *   401 — unauthorized (no valid session)
 *   429 — rate limited
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { extractRawToken } from "@/lib/sessions/extract-raw-token";
import { revokeAllOtherSessions } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";

// 10 per minute per IP — a bulk, higher-impact action than a single revoke
const isRateLimited = createRateLimiter(60_000, 10);

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  const rawToken = extractRawToken(request);
  if (!rawToken) {
    // verifySession succeeded so a cookie must exist — guard anyway
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const revokedCount = await revokeAllOtherSessions(session.userId, rawToken);
    return NextResponse.json({ revokedCount });
  } catch (error) {
    console.error("[routes-f auth-session-revoke-all DELETE]", error);
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
