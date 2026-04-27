import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/live/raid/incoming
 * Target creator polls for incoming raid.
 */
export async function GET(req: NextRequest) {
    const session = await verifySession(req);
    if (!session.ok) return session.response;

    try {
        // Find latest unacknowledged raid
        const { rows } = await sql`
      SELECT 
        r.id, 
        u.username as "raiderUsername", 
        r.viewer_count as "viewerCount", 
        r.raided_at as "raidedAt"
      FROM raids r
      JOIN users u ON r.raider_id = u.id
      WHERE r.target_id = ${session.userId} 
      AND r.is_acknowledged = FALSE
      ORDER BY r.raided_at DESC
      LIMIT 1
    `;

        if (rows.length === 0) {
            return NextResponse.json({ raid: null });
        }

        const latestRaid = rows[0];

        // Mark as acknowledged
        await sql`
      UPDATE raids
      SET is_acknowledged = TRUE
      WHERE id = ${latestRaid.id}
    `;

        return NextResponse.json({ raid: latestRaid });
    } catch (error) {
        console.error("[Raid API] Error fetching incoming raid:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
