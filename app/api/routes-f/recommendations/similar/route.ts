import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { usernameSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

const similarQuerySchema = z.object({
  username: usernameSchema,
});

type SimilarCreatorRow = {
  username: string;
  avatar: string | null;
  creator: { category?: string; tags?: string[] } | null;
  current_viewers: number | null;
  shared_tags: string[] | null;
  tag_overlap_count: number | null;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    similarQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    const { rows: creatorRows } = await sql<{
      id: string;
      username: string;
      creator: { category?: string; tags?: string[] } | null;
    }>`
      SELECT id, username, creator
      FROM users
      WHERE username = ${queryResult.data.username}
      LIMIT 1
    `;

    if (creatorRows.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const creator = creatorRows[0];
    const category = creator.creator?.category ?? null;
    const serializedTags = JSON.stringify(creator.creator?.tags ?? []);

    const { rows } = await sql<SimilarCreatorRow>`
      SELECT
        u.username,
        u.avatar,
        u.creator,
        u.current_viewers,
        COALESCE(
          ARRAY(
            SELECT DISTINCT tag
            FROM jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(COALESCE(u.creator, '{}'::jsonb)->'tags', '[]'::jsonb) = 'array'
                  THEN COALESCE(u.creator, '{}'::jsonb)->'tags'
                ELSE '[]'::jsonb
              END
            ) AS tag
            WHERE tag IN (
              SELECT jsonb_array_elements_text(${serializedTags}::jsonb)
            )
          ),
          ARRAY[]::text[]
        ) AS shared_tags,
        COALESCE(
          ARRAY_LENGTH(
            ARRAY(
              SELECT DISTINCT tag
              FROM jsonb_array_elements_text(
                CASE
                  WHEN jsonb_typeof(COALESCE(u.creator, '{}'::jsonb)->'tags', '[]'::jsonb) = 'array'
                    THEN COALESCE(u.creator, '{}'::jsonb)->'tags'
                  ELSE '[]'::jsonb
                END
              ) AS tag
              WHERE tag IN (
                SELECT jsonb_array_elements_text(${serializedTags}::jsonb)
              )
            ),
            1
          ),
          0
        )::int AS tag_overlap_count
      FROM users u
      WHERE u.id <> ${creator.id}
        AND (
          (${category} IS NOT NULL AND LOWER(COALESCE(u.creator->>'category', '')) = LOWER(${category}))
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(COALESCE(u.creator, '{}'::jsonb)->'tags', '[]'::jsonb) = 'array'
                  THEN COALESCE(u.creator, '{}'::jsonb)->'tags'
                ELSE '[]'::jsonb
              END
            ) AS tag
            WHERE tag IN (
              SELECT jsonb_array_elements_text(${serializedTags}::jsonb)
            )
          )
        )
      ORDER BY
        CASE
          WHEN ${category} IS NOT NULL
            AND LOWER(COALESCE(u.creator->>'category', '')) = LOWER(${category})
          THEN 1
          ELSE 0
        END DESC,
        tag_overlap_count DESC,
        COALESCE(u.current_viewers, 0) DESC,
        u.username ASC
      LIMIT 20
    `;

    return NextResponse.json({
      creator: queryResult.data.username,
      similar: rows.map(row => ({
        username: row.username,
        avatar: row.avatar,
        category: row.creator?.category ?? "General",
        tags: row.creator?.tags ?? [],
        viewer_count: Number(row.current_viewers ?? 0),
        reason:
          row.tag_overlap_count && row.tag_overlap_count > 0
            ? "Overlapping category and tags"
            : "Overlapping category",
        shared_tags: row.shared_tags ?? [],
      })),
    });
  } catch (error) {
    console.error("[routes-f recommendations/similar GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch similar creators" },
      { status: 500 }
    );
  }
}
