import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

async function getFollowerCount(userId: string): Promise<number> {
  const { rows } = await sql<{ follower_count: number }>`
    SELECT COUNT(*)::int AS follower_count
    FROM user_follows
    WHERE followee_id = ${userId}
  `;
  return rows[0]?.follower_count ?? 0;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  const cursor = searchParams.get("cursor");

  let limit = 20;
  if (rawLimit) {
    const parsed = parseInt(rawLimit, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json(
        { error: "limit must be an integer between 1 and 100" },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  try {
    const { rows } = cursor
      ? await sql`
          SELECT u.id, u.username, u.avatar, u.bio, uf.created_at
          FROM user_follows uf
          JOIN users u ON u.id = uf.followee_id
          WHERE uf.follower_id = ${session.userId}
            AND uf.created_at < (
              SELECT created_at
              FROM user_follows
              WHERE follower_id = ${session.userId}
                AND followee_id = ${cursor}
              LIMIT 1
            )
          ORDER BY uf.created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT u.id, u.username, u.avatar, u.bio, uf.created_at
          FROM user_follows uf
          JOIN users u ON u.id = uf.followee_id
          WHERE uf.follower_id = ${session.userId}
          ORDER BY uf.created_at DESC
          LIMIT ${limit}
        `;

    const channels = await Promise.all(
      rows.map(async (row) => {
        const followerCount = await getFollowerCount(row.id as string);
        return {
          creator: {
            id: row.id,
            username: row.username,
            avatar: row.avatar,
            bio: row.bio,
            follower_count: followerCount,
            is_following: true,
          },
          followed_at: row.created_at,
        };
      })
    );

    const nextCursor =
      rows.length === limit ? (rows[rows.length - 1].id as string) : null;

    return NextResponse.json({ channels, next_cursor: nextCursor });
  } catch (err) {
    console.error("[follow-list-mine] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
