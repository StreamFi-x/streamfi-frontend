import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureRoutesFSchema } from "../_lib/schema";

/**
 * Subscriptions management endpoint.
 */

// GET /api/routes-f/subscriptions — list active subscribers for authenticated creator
export async function GET(req: NextRequest) {
  try {
    await ensureRoutesFSchema();
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    // List active subscribers for authenticated creator
    const { rows } = await sql`
      SELECT s.id, u.username, u.avatar, s.created_at, s.expires_at, u.wallet
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.creator_id = ${session.userId} 
        AND s.status = 'active'
        AND s.expires_at > NOW()
      ORDER BY s.created_at DESC
    `;

    const subscriberCount = rows.length;
    // Assume 5 USDC flat fee for MRR
    const mrrEstimate = subscriberCount * 5;

    return NextResponse.json({
      subscribers: rows,
      count: subscriberCount,
      mrr_estimate: mrrEstimate,
    });
  } catch (error) {
    console.error("Subscription GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/routes-f/subscriptions — subscribe to a creator
export async function POST(req: NextRequest) {
  try {
    await ensureRoutesFSchema();
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    const { creator_id } = await req.json();
    if (!creator_id) {
      return NextResponse.json(
        { error: "creator_id is required" },
        { status: 400 }
      );
    }

    // Check for existing active subscription
    const existing = await sql`
      SELECT id FROM subscriptions
      WHERE user_id = ${session.userId} 
        AND creator_id = ${creator_id} 
        AND status = 'active'
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Already subscribed" },
        { status: 409 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    const { rows } = await sql`
      INSERT INTO subscriptions (user_id, creator_id, status, expires_at)
      VALUES (${session.userId}, ${creator_id}, 'active', ${expiresAt.toISOString()})
      RETURNING *
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Subscription POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
