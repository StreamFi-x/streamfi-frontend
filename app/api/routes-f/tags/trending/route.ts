import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { Redis } from "@upstash/redis";

const CACHE_KEY = "routes-f:tags:trending";
const TTL_SECONDS = 60;

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

export async function GET(): Promise<Response> {
  if (hasRedis) {
    const cached =
      await getRedis().get<Array<{ name: string; live_count: number }>>(
        CACHE_KEY
      );
    if (cached) {
      return NextResponse.json({ tags: cached, cached: true });
    }
  }

  const { rows } = await sql`
    SELECT t.name, COUNT(st.stream_id)::int as live_count
    FROM stream_tags st
    JOIN tags t ON t.id = st.tag_id
    JOIN users u ON u.id = st.stream_id AND u.is_live = true
    GROUP BY t.name
    ORDER BY live_count DESC
    LIMIT 20
  `;

  if (hasRedis) {
    await getRedis().set(CACHE_KEY, rows, { ex: TTL_SECONDS });
  }

  return NextResponse.json({ tags: rows, cached: false });
}
