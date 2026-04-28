import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/routes-f/stream/co-streamers/[username]
 * Remove co-streamer from squad.
 */
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    const { username } = await context.params;

    try {
        // Find user to remove
        const { rows: targetUser } = await sql`
      SELECT id FROM users WHERE username = ${username} LIMIT 1
    `;

        if (targetUser.length === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const { rowCount } = await sql`
      DELETE FROM squad_members
      WHERE creator_id = ${session.userId} AND user_id = ${targetUser[0].id}
    `;

        if (rowCount === 0) {
            return NextResponse.json({ error: "User is not in your squad" }, { status: 404 });
        }

        return NextResponse.json({ message: "Co-streamer removed from squad" });
    } catch (error) {
        console.error("[Co-streamers API] Error removing co-streamer:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
