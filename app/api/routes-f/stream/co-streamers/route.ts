import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inviteSchema = z.object({
    username: z.string().min(1),
});

/**
 * GET /api/routes-f/stream/co-streamers
 * List current co-streamers for authenticated creator's live stream.
 */
export async function GET(req: NextRequest) {
    const session = await verifySession(req);
    if (!session.ok) return session.response;

    try {
        const { rows } = await sql`
      SELECT u.id, u.username, u.avatar, sm.joined_at as "joinedAt"
      FROM squad_members sm
      JOIN users u ON sm.user_id = u.id
      WHERE sm.creator_id = ${session.userId}
      ORDER BY sm.joined_at ASC
    `;

        return NextResponse.json({ coStreamers: rows });
    } catch (error) {
        console.error("[Co-streamers API] Error fetching squad:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/routes-f/stream/co-streamers
 * Invite a co-streamer (username)
 */
export async function POST(req: NextRequest) {
    const session = await verifySession(req);
    if (!session.ok) return session.response;

    try {
        const body = await req.json();
        const result = inviteSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        const { username } = result.data;

        // Check if creator is live
        const { rows: creatorStatus } = await sql`
      SELECT is_live FROM users WHERE id = ${session.userId} LIMIT 1
    `;
        if (!creatorStatus[0]?.is_live) {
            return NextResponse.json({ error: "You must be live to invite co-streamers" }, { status: 400 });
        }

        // Find invitee
        const { rows: invitee } = await sql`
      SELECT id, is_live FROM users WHERE username = ${username} LIMIT 1
    `;

        if (invitee.length === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (invitee[0].id === session.userId) {
            return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
        }

        if (!invitee[0].is_live) {
            return NextResponse.json({ error: "Target user must be live to join a squad" }, { status: 400 });
        }

        // Check squad size
        const { rows: squadCount } = await sql`
      SELECT COUNT(*) as count FROM squad_members WHERE creator_id = ${session.userId}
    `;
        if (parseInt(squadCount[0].count) >= 3) {
            return NextResponse.json({ error: "Maximum squad size of 3 reached" }, { status: 400 });
        }

        // Create invite (expires in 5 mins)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        await sql`
      INSERT INTO co_stream_invites (creator_id, invitee_id, expires_at)
      VALUES (${session.userId}, ${invitee[0].id}, ${expiresAt})
    `;

        return NextResponse.json({ message: "Invitation sent", expiresAt });
    } catch (error) {
        console.error("[Co-streamers API] Error sending invite:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
