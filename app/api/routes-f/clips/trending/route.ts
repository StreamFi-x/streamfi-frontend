import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

/**
 * GET /api/routes-f/clips/trending
 * Returns top clips ranked by a gravity score: views / (hours_since_created + 2)^1.5
 * Query params: ?category=&period=24h|7d|30d&limit=20&cursor=
 */

const trendingQuerySchema = z.object({
  category: z.string().optional(),
  period: z.enum(["24h", "7d", "30d"]).default("7d"),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, trendingQuerySchema);
  if (queryResult instanceof Response) return queryResult;

  const { category, period, limit, cursor } = queryResult.data;
  const since = new Date(
    Date.now() -
      (period === "24h"
        ? 24 * 60 * 60 * 1000
        : period === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000)
  ).toISOString();

  try {
    // Gravity score: views / (hours_since_created + 2)^1.5
    // Cursor is the last returned clip id for pagination
    let rows: Record<string, unknown>[];

    if (category) {
      if (cursor) {
        const { rows: r } = await sql`
          SELECT
            r.id,
            r.playback_id,
            r.title,
            u.username AS creator_username,
            r.view_count,
            r.duration,
            r.created_at,
            (r.view_count::float /
              POWER(
                EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600.0 + 2,
                1.5
              )
            ) AS score
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id
          WHERE r.status = 'ready'
            AND r.created_at >= ${since}
            AND r.category = ${category}
            AND r.id < ${cursor}
          ORDER BY score DESC, r.id DESC
          LIMIT ${limit}
        `;
        rows = r;
      } else {
        const { rows: r } = await sql`
          SELECT
            r.id,
            r.playback_id,
            r.title,
            u.username AS creator_username,
            r.view_count,
            r.duration,
            r.created_at,
            (r.view_count::float /
              POWER(
                EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600.0 + 2,
                1.5
              )
            ) AS score
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id
          WHERE r.status = 'ready'
            AND r.created_at >= ${since}
            AND r.category = ${category}
          ORDER BY score DESC, r.id DESC
          LIMIT ${limit}
        `;
        rows = r;
      }
    } else {
      if (cursor) {
        const { rows: r } = await sql`
          SELECT
            r.id,
            r.playback_id,
            r.title,
            u.username AS creator_username,
            r.view_count,
            r.duration,
            r.created_at,
            (r.view_count::float /
              POWER(
                EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600.0 + 2,
                1.5
              )
            ) AS score
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id
          WHERE r.status = 'ready'
            AND r.created_at >= ${since}
            AND r.id < ${cursor}
          ORDER BY score DESC, r.id DESC
          LIMIT ${limit}
        `;
        rows = r;
      } else {
        const { rows: r } = await sql`
          SELECT
            r.id,
            r.playback_id,
            r.title,
            u.username AS creator_username,
            r.view_count,
            r.duration,
            r.created_at,
            (r.view_count::float /
              POWER(
                EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600.0 + 2,
                1.5
              )
            ) AS score
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id
          WHERE r.status = 'ready'
            AND r.created_at >= ${since}
          ORDER BY score DESC, r.id DESC
          LIMIT ${limit}
        `;
        rows = r;
      }
    }

    const nextCursor =
      rows.length === limit ? (rows[rows.length - 1].id as string) : null;

    return NextResponse.json({
      period,
      category: category ?? null,
      clips: rows.map(({ score: _score, ...clip }) => clip),
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error("[clips/trending] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

