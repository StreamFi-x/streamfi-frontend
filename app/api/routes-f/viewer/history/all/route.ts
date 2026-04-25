import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function DELETE(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) return session.response;

  try {
    const { rowCount } = await sql`
      DELETE FROM watch_history WHERE user_id = ${session.userId}
    `;

    return NextResponse.json({ deleted: true, count: rowCount ?? 0 });
  } catch (error) {
    console.error("[routes-f viewer/history/all DELETE]", error);
    return NextResponse.json({ error: "Failed to clear watch history" }, { status: 500 });
  }
}
