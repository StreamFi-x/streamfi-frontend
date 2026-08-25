import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function pageParam(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const username = searchParams.get("username")?.trim();
  const channelId = searchParams.get("channel_id")?.trim();
  const page = pageParam(searchParams.get("page"), 1);
  const limit = Math.min(pageParam(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
  const offset = (page - 1) * limit;

  if (!username && !channelId) {
    return NextResponse.json(
      { error: "username or channel_id is required" },
      { status: 400 }
    );
  }

  const channelResult = channelId
    ? await sql`SELECT id FROM users WHERE id::text = ${channelId}`
    : await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${username})`;
  const channel = channelResult.rows[0];

  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  const [{ rows: countRows }, { rows: followerRows }] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM user_follows WHERE followee_id = ${channel.id}`,
    sql`
      SELECT u.id, u.username, u.avatar, u.bio
      FROM user_follows uf
      JOIN users u ON u.id = uf.follower_id
      WHERE uf.followee_id = ${channel.id}
      ORDER BY uf.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  return NextResponse.json({
    followers: followerRows,
    pagination: {
      page,
      limit,
      total,
      has_more: offset + followerRows.length < total,
    },
  });
}
