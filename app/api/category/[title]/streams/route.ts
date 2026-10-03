import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";

/**
 * GET /api/category/[title]/streams
 *
 * Retrieves paginated list of streams within a specific category.
 *
 * Query parameters:
 *   limit     — items per page (1-100, default 20)
 *   sort_by   — sorting option: "viewers" (default), "recent"
 *   offset    — pagination offset (default 0)
 *
 * Response:
 *   {
 *     success: boolean,
 *     streams: Array<{
 *       id: UUID,
 *       username: string,
 *       title: string,
 *       is_live: boolean,
 *       current_viewers: number,
 *       stream_started_at: ISO timestamp | null,
 *       avatar: string | null,
 *       followers_count: number
 *     }>,
 *     total_count: number,
 *     pagination: {
 *       limit: number,
 *       offset: number,
 *       returned: number,
 *       has_more: boolean
 *     }
 *   }
 *
 * Error responses:
 *   400 — invalid query parameters
 *   404 — category not found
 *   500 — database error
 */

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort_by: z.enum(["viewers", "recent"]).default("viewers"),
});

interface StreamRow {
  id: string;
  username: string;
  title: string;
  is_live: boolean;
  current_viewers: number;
  stream_started_at: string | null;
  avatar: string | null;
  followers_count: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title } = await params;

  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const validation = querySchema.safeParse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      sort_by: searchParams.get("sort_by"),
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { limit, offset, sort_by } = validation.data;

    // Verify category exists
    const categoryResult = await sql`
      SELECT id FROM stream_categories 
      WHERE LOWER(title) = LOWER(${title})
    `;

    if (categoryResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    // Build query based on sort preference
    // Default: live streams first (by viewer count), then offline by recency
    let streams: StreamRow[] = [];

    if (sort_by === "recent") {
      // Sort by stream recency (newest first)
      const result = await sql`
        SELECT 
          u.id,
          u.username,
          u.mux_stream_id as title,
          u.is_live,
          u.current_viewers,
          u.stream_started_at,
          u.avatar,
          COALESCE(array_length(u.followers, 1), 0) as followers_count
        FROM users u
        WHERE u.categories @> ARRAY[${title}]
        ORDER BY u.stream_started_at DESC NULLS LAST, u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      streams = result.rows as StreamRow[];
    } else {
      // Default: sort by viewer count (live first, then by viewers)
      const result = await sql`
        SELECT 
          u.id,
          u.username,
          u.mux_stream_id as title,
          u.is_live,
          u.current_viewers,
          u.stream_started_at,
          u.avatar,
          COALESCE(array_length(u.followers, 1), 0) as followers_count
        FROM users u
        WHERE u.categories @> ARRAY[${title}]
        ORDER BY u.is_live DESC, u.current_viewers DESC, u.stream_started_at DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `;
      streams = result.rows as StreamRow[];
    }

    // Get total count for this category
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM users u
      WHERE u.categories @> ARRAY[${title}]
    `;
    const totalCount = (countResult.rows[0] as { total: number }).total;

    // Determine if there are more results
    const hasMore = offset + limit < totalCount;

    return NextResponse.json({
      success: true,
      streams,
      total_count: totalCount,
      pagination: {
        limit,
        offset,
        returned: streams.length,
        has_more: hasMore,
      },
    });
  } catch (error) {
    console.error("Error fetching category streams:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch category streams",
        details: message,
      },
      { status: 500 }
    );
  }
}
