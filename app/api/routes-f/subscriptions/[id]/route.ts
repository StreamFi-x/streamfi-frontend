import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession, assertOwnership } from "@/lib/auth/verify-session";
import { ensureRoutesFSchema } from "../../_lib/schema";

/**
 * DELETE /api/routes-f/subscriptions/[id] — cancel subscription
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureRoutesFSchema();
    const session = await verifySession(req);
    if (!session.ok) return session.response;

    const { id } = params;

    const { rows } = await sql`
      SELECT user_id, status FROM subscriptions WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const subscription = rows[0];
    const ownershipError = assertOwnership(session, null, subscription.user_id);
    if (ownershipError) return ownershipError;

    if (subscription.status === 'cancelled') {
      return NextResponse.json({ message: "Subscription already cancelled" });
    }

    await sql`
      UPDATE subscriptions SET status = 'cancelled' WHERE id = ${id}
    `;

    return NextResponse.json({ message: "Subscription cancelled successfully" });
  } catch (error) {
    console.error("Subscription DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
