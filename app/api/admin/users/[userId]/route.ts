import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }

  const { userId } = await params;

  try {
    await sql`DELETE FROM users WHERE id = ${userId}`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[admin/users/[userId]] DELETE error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
