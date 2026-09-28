import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";
import { verifySession } from "@/lib/auth/verify-session";
import { consumeStepUp } from "@/lib/security/step-up";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }

  const { userId } = await params;
  const adminSession = await verifySession(req);
  const challengeId = req.headers.get("x-step-up-challenge");
  if (!adminSession.ok || !challengeId || !(await consumeStepUp(adminSession.userId, challengeId, "admin_user_delete", userId))) {
    return Response.json({ error: "Complete two-factor verification before deleting an account" }, { status: 403 });
  }

  try {
    await sql`DELETE FROM users WHERE id = ${userId}`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[admin/users/[userId]] DELETE error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
