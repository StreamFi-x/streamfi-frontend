import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  cancelAccountDeletion,
  deletionGraceDays,
  requestAccountDeletion,
} from "@/lib/users/deletion";
import { cancelResponse } from "@/lib/users/deletion-http";

export const dynamic = "force-dynamic";

/**
 * Self-service account deletion (#1406). Every method acts on the caller's own
 * account only — the user id always comes from the verified session.
 *
 * GET    → current deletion status
 * POST   { confirm: "<your username>" } → tombstone the account; it is purged
 *        after the grace window unless cancelled
 * DELETE → cancel a pending deletion
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req, { allowPendingDeletion: true });
  if (!session.ok) {
    return session.response;
  }
  const { rows } = await sql`
    SELECT status, requested_at, purge_after, cancelled_at
    FROM user_deletions
    WHERE user_id = ${session.userId}
    ORDER BY requested_at DESC
    LIMIT 1
  `;
  return NextResponse.json({
    deletion: rows[0] ?? null,
    graceDays: deletionGraceDays(),
  });
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: { confirm?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Typing the username protects against accidental and cross-site requests.
  if (
    !session.username ||
    typeof body.confirm !== "string" ||
    body.confirm.trim().toLowerCase() !== session.username.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Confirm deletion by sending your username as `confirm`" },
      { status: 400 }
    );
  }

  const result = await requestAccountDeletion({
    userId: session.userId,
    requestedByType: "self",
    requestedBy: session.userId,
    reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
  });

  if (result.outcome === "not_found") {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      status: result.deletion.status,
      purgeAfter: result.deletion.purge_after,
      alreadyPending: result.outcome === "already_pending",
    },
    { status: result.outcome === "created" ? 201 : 200 }
  );
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession(req, { allowPendingDeletion: true });
  if (!session.ok) {
    return session.response;
  }
  const result = await cancelAccountDeletion({
    userId: session.userId,
    cancelledBy: session.userId,
  });
  return cancelResponse(result.outcome);
}
