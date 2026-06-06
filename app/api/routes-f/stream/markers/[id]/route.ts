import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

/**
 * DELETE /api/routes-f/stream/markers/[id] — remove a bookmark
 */

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { error: "Marker ID is required" },
      { status: 400 }
    );
  }

  try {
    // Delete only if it belongs to the authenticated user
    const result = await sql`
      DELETE FROM stream_markers
      WHERE id = ${id} AND user_id = ${session.userId}
    `;

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Marker not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Marker deleted successfully" });
  } catch (error) {
    console.error("[DELETE Marker] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete marker" },
      { status: 500 }
    );
  }
}
