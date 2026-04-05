import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureCollabSchema } from "../_lib/db";

const collabPatchSchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/routes-f/collab/[id]
 * Accept or decline a collab request.
 */
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const parsed = await validateBody(req, collabPatchSchema);
  if (parsed instanceof Response) {
    return parsed;
  }
  const { status } = parsed.data;

  try {
    await ensureCollabSchema();

    // 1. Fetch request and check authorization
    const { rows } = await sql`
      SELECT sender_id, receiver_id, status FROM collab_requests WHERE id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const request = rows[0];

    // Only the receiver can accept or decline
    if (request.receiver_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can only update if currently pending
    if (request.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot update request with status: ${request.status}` },
        { status: 400 }
      );
    }

    // 2. Update status
    const { rows: updatedRows } = await sql`
      UPDATE collab_requests
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(updatedRows[0]);
  } catch (error) {
    console.error("[collab:PATCH] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/routes-f/collab/[id]
 * Cancel a pending collab request.
 */
export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    await ensureCollabSchema();

    // 1. Fetch request and check authorization
    const { rows } = await sql`
      SELECT sender_id, status FROM collab_requests WHERE id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const request = rows[0];

    // Only the sender can cancel
    if (request.sender_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can only cancel if currently pending
    if (request.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot cancel request with status: ${request.status}` },
        { status: 400 }
      );
    }

    // 2. Delete request
    await sql`DELETE FROM collab_requests WHERE id = ${id}`;

    return NextResponse.json({
      message: "Collaboration request cancelled successfully",
    });
  } catch (error) {
    console.error("[collab:DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
