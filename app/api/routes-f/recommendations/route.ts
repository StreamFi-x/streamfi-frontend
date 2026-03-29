import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { getOptionalSession } from "@/app/api/routes-f/_lib/session";
import { getUpstashRedis } from "@/lib/upstash";

const recommendationsQuerySchema = z.object({
  exclude_stream_id: z.string().uuid().optional(),
});

type RecommendationRow = {
  id: string;
  username: string;
  avatar: string | null;
  current_viewers: number | null;
  creator: { streamTitle?: string; category?: string; tags?: string[] } | null;
  follow_score?: number | null;
  tip_score?: number | null;
  category_score?: number | null;
  tag_score?: number | null;
  viewer_score?: number | null;
  freshness_score?: number | null;
};

async function getCachedRecommendations<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const redis = await getUpstashRedis();
  if (redis) {
    const cached = await redis.get<T>(key);
    if (cached) {
      return cached;
    }

    const data = await loader();
    await redis.set(key, data, { ex: ttlSeconds });
    return data;
  }

  return loader();
}

function toRecommendation(row: RecommendationRow) {
  const category = row.creator?.category ?? "General";
  const reason =
    Number(row.follow_score ?? 0) > 0
      ? "Creator you follow is live"
      : Number(row.tip_score ?? 0) > 0
        ? "Creator you previously tipped"
        : Number(row.category_score ?? 0) > 0
          ? "Category you watch"
          : Number(row.tag_score ?? 0) > 0
            ? "Tags you watch"
            : Number(row.freshness_score ?? 0) > 0
              ? "New creator to discover"
              : "Trending live stream";

  return {
    username: row.username,
    avatar: row.avatar,
    stream_title: row.creator?.streamTitle ?? "Live now",
    category,
    viewer_count: Number(row.current_viewers ?? 0),
    is_live: true,
    reason,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    recommendationsQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    const session = await getOptionalSession(req);
    const excludeStreamId = queryResult.data.exclude_stream_id ?? null;
    const cacheKey = session
      ? `recommendations:user:${session.userId}:${excludeStreamId ?? "none"}`
      : `recommendations:anon:${excludeStreamId ?? "none"}`;
    const cacheTtl = session ? 300 : 120;

    const payload = await getCachedRecommendations(
      cacheKey,
      cacheTtl,
      async () => {
        if (!session) {
          const { rows } = await sql<RecommendationRow>`
          SELECT
            u.id,
            u.username,
            u.avatar,
            u.current_viewers,
            u.creator,
            (LEAST(COALESCE(u.current_viewers, 0), 1000) * 0.001)::float AS viewer_score,
            CASE
              WHEN u.created_at >= NOW() - INTERVAL '30 days' THEN 0.2
              ELSE 0
            END::float AS freshness_score
          FROM users u
          WHERE u.is_live = true
            AND (${excludeStreamId}::uuid IS NULL OR u.id <> ${excludeStreamId})
          ORDER BY
            ((LEAST(COALESCE(u.current_viewers, 0), 1000) * 0.001) +
            CASE WHEN u.created_at >= NOW() - INTERVAL '30 days' THEN 0.2 ELSE 0 END) DESC,
            u.current_viewers DESC,
            u.username ASC
          LIMIT 20
        `;

          return {
            recommended: rows.map(toRecommendation),
            anonymous: true,
          };
        }

        const { rows } = await sql<RecommendationRow>`
        WITH user_categories AS (
          SELECT DISTINCT LOWER(category) AS category
          FROM route_f_watch_events
          WHERE user_id = ${session.userId}
        ),
        user_tags AS (
          SELECT DISTINCT LOWER(tag) AS tag
          FROM route_f_watch_events e
          JOIN users watched_creator ON watched_creator.id = e.stream_id
          CROSS JOIN LATERAL UNNEST(
            COALESCE(
              ARRAY(
                SELECT jsonb_array_elements_text(
                  CASE
                    WHEN jsonb_typeof(COALESCE(watched_creator.creator, '{}'::jsonb)->'tags', '[]'::jsonb) = 'array'
                      THEN COALESCE(watched_creator.creator, '{}'::jsonb)->'tags'
                    ELSE '[]'::jsonb
                  END
                )
              ),
              ARRAY[]::text[]
            )
          ) AS tag
          WHERE e.user_id = ${session.userId}
        ),
        tipped_creators AS (
          SELECT DISTINCT recipient_id
          FROM tip_transactions
          WHERE sender_id = ${session.userId}
        )
        SELECT
          u.id,
          u.username,
          u.avatar,
          u.current_viewers,
          u.creator,
          CASE WHEN uf.follower_id IS NOT NULL THEN 1.0 ELSE 0 END::float AS follow_score,
          CASE WHEN tc.recipient_id IS NOT NULL THEN 0.9 ELSE 0 END::float AS tip_score,
          CASE
            WHEN uc.category IS NOT NULL
              AND LOWER(COALESCE(u.creator->>'category', '')) = uc.category
            THEN 0.7
            ELSE 0
          END::float AS category_score,
          CASE
            WHEN ut.tag IS NOT NULL THEN 0.6
            ELSE 0
          END::float AS tag_score,
          (LEAST(COALESCE(u.current_viewers, 0), 1000) * 0.001)::float AS viewer_score,
          CASE
            WHEN u.created_at >= NOW() - INTERVAL '30 days' THEN 0.2
            ELSE 0
          END::float AS freshness_score
        FROM users u
        LEFT JOIN user_follows uf
          ON uf.followee_id = u.id AND uf.follower_id = ${session.userId}
        LEFT JOIN tipped_creators tc
          ON tc.recipient_id = u.id
        LEFT JOIN user_categories uc
          ON LOWER(COALESCE(u.creator->>'category', '')) = uc.category
        LEFT JOIN user_tags ut
          ON EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(COALESCE(u.creator, '{}'::jsonb)->'tags', '[]'::jsonb) = 'array'
                  THEN COALESCE(u.creator, '{}'::jsonb)->'tags'
                ELSE '[]'::jsonb
              END
            ) AS creator_tag
            WHERE LOWER(creator_tag) = ut.tag
          )
        WHERE u.is_live = true
          AND u.id <> ${session.userId}
          AND (${excludeStreamId}::uuid IS NULL OR u.id <> ${excludeStreamId})
        GROUP BY
          u.id,
          u.username,
          u.avatar,
          u.current_viewers,
          u.creator,
          uf.follower_id,
          tc.recipient_id,
          uc.category,
          ut.tag
        ORDER BY
          (
            CASE WHEN uf.follower_id IS NOT NULL THEN 1.0 ELSE 0 END +
            CASE WHEN tc.recipient_id IS NOT NULL THEN 0.9 ELSE 0 END +
            CASE
              WHEN uc.category IS NOT NULL
                AND LOWER(COALESCE(u.creator->>'category', '')) = uc.category
              THEN 0.7
              ELSE 0
            END +
            CASE WHEN ut.tag IS NOT NULL THEN 0.6 ELSE 0 END +
            (LEAST(COALESCE(u.current_viewers, 0), 1000) * 0.001) +
            CASE WHEN u.created_at >= NOW() - INTERVAL '30 days' THEN 0.2 ELSE 0 END
          ) DESC,
          u.current_viewers DESC,
          u.username ASC
        LIMIT 20
      `;

        return {
          recommended: rows.map(toRecommendation),
          anonymous: false,
        };
      }
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": session
          ? "private, max-age=300"
          : "public, max-age=120",
      },
    });
  } catch (error) {
    console.error("[routes-f recommendations GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
