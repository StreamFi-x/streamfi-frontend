import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const target_id = searchParams.get("target_id");

  if (!target_id) {
    return NextResponse.json(
      { error: "target_id is required" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT 1
      FROM user_follows
      WHERE follower_id = ${session.userId}
        AND followee_id = ${target_id}
      LIMIT 1
    `;

    return NextResponse.json({ is_following: rows.length > 0 });
  } catch (err) {
    console.error("[follow-is-following] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
