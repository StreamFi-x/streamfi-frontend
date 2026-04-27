import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

const createFollowSchema = z.object({
  creator_id: z.string().uuid(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

type FollowerCountRow = { follower_count: number };

async function getFollowerCount(userId: string): Promise<number> {
  const { rows } = await sql<FollowerCountRow>`
    SELECT COUNT(*)::int AS follower_count
    FROM user_follows
    WHERE followee_id = ${userId}
  `;
  return rows[0]?.follower_count ?? 0;
}

async function getIsFollowing(
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

    const enriched = await Promise.all(
      rows.map(async row => {
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
    return NextResponse.json({ follows: enriched, next_cursor: nextCursor });
  } catch (err) {
    console.error("[follows] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createFollowSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { creator_id } = bodyResult.data;

  if (creator_id === session.userId) {
    return NextResponse.json(
      { error: "Cannot follow yourself" },
      { status: 400 }
    );
  }

  try {
    const { rows: creatorRows } = await sql`
      SELECT id, username, avatar, bio
      FROM users
      WHERE id = ${creator_id}
      LIMIT 1
    `;

    if (creatorRows.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const insertResult = await sql`
      INSERT INTO user_follows (follower_id, followee_id)
      VALUES (${session.userId}, ${creator_id})
      ON CONFLICT DO NOTHING
      RETURNING follower_id
    `;

    if ((insertResult.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Already following creator" },
        { status: 409 }
      );
    }

    const followerCount = await getFollowerCount(creator_id);
    const isFollowing = await getIsFollowing(session.userId, creator_id);

    const creator = creatorRows[0];
    return NextResponse.json(
      {
        creator: {
          id: creator.id,
          username: creator.username,
          avatar: creator.avatar,
          bio: creator.bio,
          follower_count: followerCount,
          is_following: isFollowing,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[follows] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
