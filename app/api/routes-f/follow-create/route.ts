import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { insertActivityEvent } from "@/app/api/routes-f/activity/_lib/insert";

const createFollowSchema = z.object({
  channel_id: z.string().uuid(),
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createFollowSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { channel_id } = bodyResult.data;

  if (channel_id === session.userId) {
    return NextResponse.json(
      { error: "Cannot follow yourself" },
      { status: 400 }
    );
  }

  try {
    const { rows: channelRows } = await sql`
      SELECT id, username, avatar, bio
      FROM users
      WHERE id = ${channel_id}
      LIMIT 1
    `;

    if (channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const insertResult = await sql`
      INSERT INTO user_follows (follower_id, followee_id)
      VALUES (${session.userId}, ${channel_id})
      ON CONFLICT DO NOTHING
      RETURNING follower_id
    `;

    if ((insertResult.rowCount ?? 0) > 0) {
      try {
        await insertActivityEvent({
          userId: channel_id,
          type: "new_follower",
          actorId: session.userId,
          metadata: { source: "routes-f/follow-create" },
        });
      } catch (activityErr) {
        console.error("[follow-create] activity event insert failed:", activityErr);
      }
    }

    const followerCount = await getFollowerCount(channel_id);
    const channel = channelRows[0];
    
    return NextResponse.json(
      {
        channel: {
          id: channel.id,
          username: channel.username,
          avatar: channel.avatar,
          bio: channel.bio,
          follower_count: followerCount,
          is_following: true,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[follow-create] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
