import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id } = body as Record<string, unknown>;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  if (creator_id === session.userId) {
    return NextResponse.json(
      { error: "Cannot unfollow yourself" },
      { status: 400 }
    );
  }

  try {
    const result = await sql`
      DELETE FROM user_follows
      WHERE follower_id = ${session.userId}
        AND followee_id = ${creator_id}
    `;

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Not following this creator" },
        { status: 404 }
      );
    }

    return NextResponse.json({ unfollowed: true });
  } catch (err) {
    console.error("[follow-delete] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
