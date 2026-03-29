import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureHighlightsSchema } from "../_lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
    await ensureHighlightsSchema();

    const { rows } = await sql`
      DELETE FROM route_f_highlights
      WHERE id = ${id} AND user_id = ${session.userId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Highlight not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("[highlights] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
