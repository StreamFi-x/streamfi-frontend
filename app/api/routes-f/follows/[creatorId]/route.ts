import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { creatorId } = await params;

  if (creatorId === session.userId) {
    return NextResponse.json(
      { error: "Cannot unfollow yourself" },
      { status: 400 }
    );
  }

  try {
    const { rowCount } = await sql`
      DELETE FROM user_follows
      WHERE follower_id = ${session.userId}
        AND followee_id = ${creatorId}
    `;

    if ((rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Follow relationship not found" },
        { status: 404 }
      );
    }

    const { rows } = await sql`
      SELECT COUNT(*)::int AS follower_count
      FROM user_follows
      WHERE followee_id = ${creatorId}
    `;

    return NextResponse.json({
      creator_id: creatorId,
      follower_count: rows[0]?.follower_count ?? 0,
      is_following: false,
    });
  } catch (err) {
    console.error("[follows/:creatorId] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
