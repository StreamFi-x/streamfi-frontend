import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const acceptSchema = z.object({
    creatorId: z.string().uuid(),
});

/**
 * POST /api/routes-f/stream/co-streamers/accept
 * Invitee accepts squad invite.
 */
export async function POST(req: NextRequest) {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    try {
        const body = await req.json();
        const result = acceptSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: "creatorId is required" }, { status: 400 });
        }

        const { creatorId } = result.data;

        // Find valid invite
        const { rows: invite } = await sql`
      SELECT id, creator_id, invitee_id, expires_at, status
      FROM co_stream_invites
      WHERE creator_id = ${creatorId} AND invitee_id = ${session.userId}
      AND status = 'pending'
      AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `;

        if (invite.length === 0) {
            return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
        }

        // Both must be live
        const { rows: statuses } = await sql`
      SELECT id, is_live FROM users WHERE id IN (${creatorId}, ${session.userId})
    `;

        const creatorStatus = statuses.find(s => s.id === creatorId);
        const inviteeStatus = statuses.find(s => s.id === session.userId);

        if (!creatorStatus?.is_live || !inviteeStatus?.is_live) {
            return NextResponse.json({ error: "Both streamers must be live to join a squad" }, { status: 400 });
        }

        // Check squad size again
        const { rows: squadCount } = await sql`
      SELECT COUNT(*) as count FROM squad_members WHERE creator_id = ${creatorId}
    `;
        if (parseInt(squadCount[0].count) >= 3) {
            return NextResponse.json({ error: "Squad is already full (max 3 co-streamers)" }, { status: 400 });
        }

        // Transaction to accept invite and join squad
        await sql`BEGIN`;

        await sql`
      UPDATE co_stream_invites SET status = 'accepted' WHERE id = ${invite[0].id}
    `;

        await sql`
      INSERT INTO squad_members (creator_id, user_id)
      VALUES (${creatorId}, ${session.userId})
      ON CONFLICT DO NOTHING
    `;

        await sql`COMMIT`;

        return NextResponse.json({ message: "Squad invite accepted" });
    } catch (error) {
        if (error) {
            await sql`ROLLBACK`;
        }
        console.error("[Co-streamers API] Error accepting invite:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
