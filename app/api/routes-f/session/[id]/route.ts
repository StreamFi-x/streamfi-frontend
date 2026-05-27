/**
 * DELETE /api/routes-f/session/[id]
 *
 * Revokes a specific session by its UUID.
 * The authenticated user can only revoke their own sessions.
 *
 * - Revoking the current session is allowed (effectively a logout from this device).
 * - Revocation takes effect immediately — the next request with that token will be
 *   rejected by verifySession.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { revokeSession } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";

// 20 revocations per minute per IP
const isRateLimited = createRateLimiter(60_000, 20);

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // 3. Validate the target session ID
  const { id } = await params;
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid session ID" },
      { status: 400 }
    );
  }

  // 4. Revoke — the helper enforces user_id ownership so users can't revoke
  //    sessions belonging to other accounts.
  try {
    const revoked = await revokeSession(id, session.userId);
    if (!revoked) {
      // Either the session doesn't exist, belongs to another user, or was
      // already revoked — return 404 in all cases to avoid leaking existence.
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, revoked: id });
  } catch (err) {
    console.error("[DELETE /api/routes-f/session/[id]] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
