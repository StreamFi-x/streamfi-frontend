import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureRoutesFSchema } from "../../_lib/schema";

/**
 * GET /api/routes-f/subscriptions/status?creator= — viewer checks own subscription status to a creator
 */
export async function GET(req: NextRequest) {
  try {
    await ensureRoutesFSchema();
    const session = await verifySession(req);
    if (!session.ok) return session.response;

    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creator");

    if (!creatorId) {
      return NextResponse.json({ error: "creator query param is required" }, { status: 400 });
    }

    // Check subscription status to a specific creator
    const { rows } = await sql`
      SELECT id, expires_at, status
      FROM subscriptions
      WHERE user_id = ${session.userId} 
        AND creator_id = ${creatorId} 
        AND status = 'active'
        AND expires_at > NOW()
      LIMIT 1
    `;

    return NextResponse.json({
      is_subscribed: rows.length > 0,
      subscription: rows[0] || null
    });
  } catch (error) {
    console.error("Subscription status GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
