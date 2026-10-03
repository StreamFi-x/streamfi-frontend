import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";
import { verifySession } from "@/lib/auth/verify-session";
import { consumeStepUp } from "@/lib/security/step-up";
import { requireAdminIdentity, requireAdminSession } from "@/lib/admin-auth";
import { currentAdminPrivyId, requireAdminIdentity, requireAdminSession } from "@/lib/admin-auth";
import { withAdminAudit } from "@/lib/audit/admin-events";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { requestAccountDeletion } from "@/lib/users/deletion";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const adminDenied = await requireAdminSession("admin/users/[userId]");
  if (adminDenied) {
    return adminDenied;
  }

  const { userId } = await params;
  const adminSession = await verifySession(req);
  const challengeId = req.headers.get("x-step-up-challenge");
  if (!adminSession.ok || !challengeId || !(await consumeStepUp(adminSession.userId, challengeId, "admin_user_ban", userId))) {
    return Response.json({ error: "Complete two-factor verification before changing account status" }, { status: 403 });
  }
  const body = await req.json();
  const action: string = body.action;
  const reason: string | undefined = body.reason;

  if (action !== "ban" && action !== "unban") {
    return Response.json(
      { error: "action must be 'ban' or 'unban'" },
      { status: 400 }
    );
  }

  try {
    await withAdminAudit(
      { actorId: await currentAdminPrivyId(), action: `user_${action}`, targetType: "user", targetId: userId },
      async tx => {
        const { rows: beforeRows } = await tx.sql`SELECT is_banned, banned_at, ban_reason FROM users WHERE id = ${userId} FOR UPDATE`;
        if (!beforeRows.length) {throw new Error("ADMIN_USER_NOT_FOUND");}
        const { rows } = action === "ban"
          ? await tx.sql`UPDATE users SET is_banned = true, banned_at = now(), ban_reason = ${reason ?? null} WHERE id = ${userId} RETURNING is_banned, banned_at, ban_reason`
          : await tx.sql`UPDATE users SET is_banned = false, banned_at = null, ban_reason = null WHERE id = ${userId} RETURNING is_banned, banned_at, ban_reason`;
        return { result: rows[0], beforeState: beforeRows[0], afterState: rows[0] };
      }
    );
    await invalidateUserCaches({ id: userId });

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "ADMIN_USER_NOT_FOUND") {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    console.error("[admin/users/[userId]] PATCH error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Admin account deletion. This no longer hard-deletes: the user is tombstoned
 * and purged after the grace window (#1406). Cancel with
 * DELETE /api/admin/users/[userId]/deletion.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const { admin, response } = await requireAdminIdentity(
    "admin/users/[userId]"
  );
  if (response) {
    return response;
  }

  const { userId } = await params;
  const adminSession = await verifySession(req);
  const challengeId = req.headers.get("x-step-up-challenge");
  if (!adminSession.ok || !challengeId || !(await consumeStepUp(adminSession.userId, challengeId, "admin_user_delete", userId))) {
    return Response.json({ error: "Complete two-factor verification before deleting an account" }, { status: 403 });
  }
  const reason = new URL(req.url).searchParams.get("reason");

  try {
    const result = await requestAccountDeletion({
      userId,
      requestedByType: "admin",
      requestedBy: admin,
      reason: reason ? reason.slice(0, 500) : null,
    });
    if (result.outcome === "not_found") {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    return Response.json({
      ok: true,
      status: result.deletion.status,
      purgeAfter: result.deletion.purge_after,
      alreadyPending: result.outcome === "already_pending",
    });
  } catch (err) {
    console.error("[admin/users/[userId]] DELETE error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
