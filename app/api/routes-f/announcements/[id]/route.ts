import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession, assertOwnership } from "@/lib/auth/verify-session";
import { ensureRoutesFSchema } from "../../_lib/schema";

/**
 * DELETE /api/routes-f/announcements/[id] — creator removes own announcement
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureRoutesFSchema();
    const session = await verifySession(req);
    if (!session.ok) return session.response;

    const { id } = await params;

    const { rows } = await sql`
      SELECT creator_id FROM announcements WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    const announcement = rows[0];
    const ownershipError = assertOwnership(
      session,
      null,
      announcement.creator_id
    );
    if (ownershipError) return ownershipError;

    await sql`DELETE FROM announcements WHERE id = ${id}`;

    return NextResponse.json({ message: "Announcement deleted successfully" });
  } catch (error) {
    console.error("Announcement DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
