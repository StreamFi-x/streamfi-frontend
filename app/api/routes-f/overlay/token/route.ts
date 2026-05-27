import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { signToken } from "@/lib/auth/sign-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/overlay/token
 * Authenticated creator generates or rotates their overlay token.
 */
export async function GET(req: NextRequest) {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    try {
        // Generate new token (no exp)
        const token = signToken({ userId: session.userId, type: "overlay" }, secret);

        // Save to DB (overwrite existing)
        await sql`
      INSERT INTO user_overlay_config (user_id, token, updated_at)
      VALUES (${session.userId}, ${token}, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET token = EXCLUDED.token, updated_at = CURRENT_TIMESTAMP
    `;

        return NextResponse.json({ token });
    } catch (error) {
        console.error("[Overlay Token API] Error generating token:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
