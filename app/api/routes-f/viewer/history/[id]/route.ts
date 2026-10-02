import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    const { rows } = await sql`
      DELETE FROM watch_history
      WHERE id = ${id} AND user_id = ${session.userId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "History entry not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("[routes-f viewer/history/[id] DELETE]", error);
    return NextResponse.json({ error: "Failed to delete history entry" }, { status: 500 });
  }
}
