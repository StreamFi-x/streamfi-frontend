import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureCollabSchema } from "./_lib/db";

const collabRequestSchema = z.object({
  target_username: z.string().trim().min(1, "target_username is required"),
  message: z.string().trim().min(1, "message is required").max(500),
  proposed_date: z.string().datetime().optional().nullable(),
});

/**
 * GET /api/routes-f/collab
 * List incoming and outgoing collab requests.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  await ensureCollabSchema();

  try {
    const { rows } = await sql`
      SELECT 
        c.id, 
        c.status, 
        c.message, 
        c.proposed_date, 
        c.created_at,
        u_sender.username AS sender_username,
        u_sender.avatar AS sender_avatar,
        u_receiver.username AS receiver_username,
        u_receiver.avatar AS receiver_avatar,
        CASE WHEN c.sender_id = ${session.userId} THEN 'outgoing' ELSE 'incoming' END AS direction
      FROM collab_requests c
      JOIN users u_sender ON c.sender_id = u_sender.id
      JOIN users u_receiver ON c.receiver_id = u_receiver.id
      WHERE c.sender_id = ${session.userId} OR c.receiver_id = ${session.userId}
      ORDER BY c.created_at DESC
    `;

    return NextResponse.json({ requests: rows });
  } catch (error) {
    console.error("[collab:GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routes-f/collab
 * Send a collab request.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const parsed = await validateBody(req, collabRequestSchema);
  if (parsed instanceof Response) {
    return parsed;
  }
  const { target_username, message, proposed_date } = parsed.data;

  try {
    await ensureCollabSchema();

    // 1. Resolve receiver ID
    const { rows: receiverRows } = await sql`
      SELECT id FROM users WHERE LOWER(username) = LOWER(${target_username})
    `;
    if (receiverRows.length === 0) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }
    const receiverId = receiverRows[0].id;

    if (receiverId === session.userId) {
      return NextResponse.json(
        { error: "You cannot collab with yourself" },
        { status: 400 }
      );
    }

    // 2. Validate proposed_date is in the future
    if (proposed_date) {
      if (new Date(proposed_date) <= new Date()) {
        return NextResponse.json(
          { error: "proposed_date must be in the future" },
          { status: 400 }
        );
      }
    }

    // 3. Check for blocks
    const { rows: blockRows } = await sql`
      SELECT 1 FROM user_blocklist 
      WHERE user_id = ${receiverId} AND target_id = ${session.userId} AND action = 'block'
    `;
    if (blockRows.length > 0) {
      return NextResponse.json(
        { error: "You cannot send a request to this user" },
        { status: 403 }
      );
    }

    // 4. Check for max 5 pending outgoing requests
    const { rows: pendingRows } = await sql`
      SELECT COUNT(*)::int AS count FROM collab_requests 
      WHERE sender_id = ${session.userId} AND status = 'pending'
    `;
    if (pendingRows[0].count >= 5) {
      return NextResponse.json(
        { error: "Maximum of 5 pending requests reached" },
        { status: 429 }
      );
    }

    // 5. Check for existing pending request between these two
    const { rows: existingRows } = await sql`
      SELECT id FROM collab_requests
      WHERE (sender_id = ${session.userId} AND receiver_id = ${receiverId} AND status = 'pending')
         OR (sender_id = ${receiverId} AND receiver_id = ${session.userId} AND status = 'pending')
    `;
    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: "A pending request already exists between you" },
        { status: 409 }
      );
    }

    // 6. Create request
    const { rows } = await sql`
      INSERT INTO collab_requests (sender_id, receiver_id, message, proposed_date)
      VALUES (${session.userId}, ${receiverId}, ${message}, ${proposed_date})
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[collab:POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
