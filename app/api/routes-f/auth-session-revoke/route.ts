/**
 * DELETE /api/routes-f/auth-session-revoke
 *
 * Revokes a single active session belonging to the current user, identified
 * by `sessionId` in the JSON body. Only the session owner can revoke their
 * own sessions — `revokeSession` scopes the update to the authenticated
 * user's id, so a sessionId belonging to another user silently matches zero
 * rows rather than leaking whether it exists.
 *
 * Response shape:
 * { "revoked": true }
 *
 * Error responses:
 *   400 — invalid body
 *   401 — unauthorized (no valid session)
 *   404 — sessionId not found, already revoked, or belongs to another user
 *   429 — rate limited
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { revokeSession } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";

// 20 revokes per minute per IP — generous for legitimate use, bounds abuse
const isRateLimited = createRateLimiter(60_000, 20);

const revokeSchema = z.object({
  sessionId: z.string().uuid("sessionId must be a valid UUID"),
});

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

  const body = await validateBody(request, revokeSchema);
  if (body instanceof NextResponse) {
    return body;
  }

  try {
    const revoked = await revokeSession(body.data.sessionId, session.userId);

    if (!revoked) {
      return NextResponse.json(
        { error: "Session not found or already revoked" },
        { status: 404 }
      );
    }

    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error("[routes-f auth-session-revoke DELETE]", error);
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
  }
}
