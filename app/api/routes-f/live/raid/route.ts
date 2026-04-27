import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const raidSchema = z.object({
    targetUsername: z.string().min(1),
    viewerCount: z.number().int().nonnegative(),
});

/**
 * POST /api/routes-f/live/raid
 * Initiate a raid.
 */
export async function POST(req: NextRequest) {
    const session = await verifySession(req);
    if (!session.ok) return session.response;

    try {
        const body = await req.json();
        const result = raidSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: "Invalid request body", details: result.error.format() }, { status: 400 });
        }

        const { targetUsername, viewerCount } = result.data;

        // Check if raider is live
        const { rows: raiderStatus } = await sql`
      SELECT is_live FROM users WHERE id = ${session.userId} LIMIT 1
    `;
        if (!raiderStatus[0]?.is_live) {
            return NextResponse.json({ error: "Only active streamers can initiate a raid" }, { status: 400 });
        }

        // Find target
        const { rows: target } = await sql`
      SELECT id, is_live FROM users WHERE username = ${targetUsername} LIMIT 1
    `;

        if (target.length === 0) {
            return NextResponse.json({ error: "Target user not found" }, { status: 404 });
        }

        if (target[0].id === session.userId) {
            return NextResponse.json({ error: "You cannot raid yourself" }, { status: 400 });
        }

        if (!target[0].is_live) {
            return NextResponse.json({ error: "Target streamer must be live to be raided" }, { status: 400 });
        }

        // Record the raid
        await sql`
      INSERT INTO raids (raider_id, target_id, viewer_count)
      VALUES (${session.userId}, ${target[0].id}, ${viewerCount})
    `;

        return NextResponse.json({ message: `Raid initiated to ${targetUsername} with ${viewerCount} viewers` });
    } catch (error) {
        console.error("[Raid API] Error initiating raid:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
