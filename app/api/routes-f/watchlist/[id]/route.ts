import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    const { rowCount } = await sql`
      DELETE FROM user_watchlist
      WHERE id = ${id}
        AND user_id = ${session.userId}
    `;

    if ((rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Watchlist item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Removed from watchlist" });
  } catch (err) {
    console.error("[watchlist/:id] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
