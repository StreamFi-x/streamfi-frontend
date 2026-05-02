import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

async function isFollowing(
  followerId: string,
  followeeId: string
): Promise<boolean> {
  const { rows } = await sql`
    SELECT 1
    FROM user_follows
    WHERE follower_id = ${followerId}
      AND followee_id = ${followeeId}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { rows: creatorRows } = await sql`
    SELECT id FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  if (creatorRows.length === 0) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, listQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { limit, cursor } = queryResult.data;

  try {
    const { rows } = cursor
      ? await sql`
          SELECT u.id, u.username, u.avatar, u.bio, uf.created_at
          FROM user_follows uf
          JOIN users u ON u.id = uf.follower_id
          WHERE uf.followee_id = ${session.userId}
            AND uf.created_at < (
              SELECT created_at
              FROM user_follows
              WHERE followee_id = ${session.userId}
                AND follower_id = ${cursor}
              LIMIT 1
            )
          ORDER BY uf.created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT u.id, u.username, u.avatar, u.bio, uf.created_at
          FROM user_follows uf
          JOIN users u ON u.id = uf.follower_id
          WHERE uf.followee_id = ${session.userId}
          ORDER BY uf.created_at DESC
          LIMIT ${limit}
        `;

    const followers = await Promise.all(
      rows.map(async row => ({
        follower: {
          id: row.id,
          username: row.username,
          avatar: row.avatar,
          bio: row.bio,
          is_following: await isFollowing(session.userId, row.id as string),
        },
        followed_at: row.created_at,
      }))
    );

    const nextCursor =
      rows.length === limit ? (rows[rows.length - 1].id as string) : null;
    return NextResponse.json({ followers, next_cursor: nextCursor });
  } catch (err) {
    console.error("[follows/followers] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
