import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import {
  verifyAdminSession,
  adminUnauthorized,
  getAdminIdentity,
} from "@/lib/admin-auth";
import { requestAccountDeletion } from "@/lib/users/deletion";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }

  const { userId } = await params;
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
    if (action === "ban") {
      await sql`
        UPDATE users
        SET is_banned  = true,
            banned_at  = now(),
            ban_reason = ${reason ?? null}
        WHERE id = ${userId}
      `;
    } else {
      await sql`
        UPDATE users
        SET is_banned  = false,
            banned_at  = null,
            ban_reason = null
        WHERE id = ${userId}
      `;
    }

    return Response.json({ ok: true });
  } catch (err) {
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
  const admin = await getAdminIdentity();
  if (!admin) {
    return adminUnauthorized();
  }

  const { userId } = await params;
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
