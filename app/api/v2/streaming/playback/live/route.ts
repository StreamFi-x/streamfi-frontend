import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { livepeerService } from "@/lib/streaming/livepeer-service";

/**
 * GET /api/v2/streaming/playback/live
 * Get all currently live streams
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    // Build query for live streams
    let query = `
      SELECT 
        u.id,
        u.username,
        u.wallet,
        u.livepeer_stream_id_v2,
        u.playback_id_v2,
        u.is_live_v2,
        u.stream_started_at_v2,
        u.stream_title_v2,
        u.stream_description_v2,
        u.stream_category_v2,
        u.stream_tags_v2
      FROM users u
      WHERE u.is_live_v2 = true 
        AND u.livepeer_stream_id_v2 IS NOT NULL 
        AND u.playback_id_v2 IS NOT NULL
    `;

    const queryParams: any[] = [];
    let paramCount = 1;

    // Add category filter
    if (category) {
      query += ` AND u.stream_category_v2 = $${paramCount}`;
      queryParams.push(category);
      paramCount++;
    }

    // Add search filter
    if (search) {
      query += ` AND (
        u.username ILIKE $${paramCount} OR 
        u.stream_title_v2 ILIKE $${paramCount} OR
        u.stream_description_v2 ILIKE $${paramCount}
      )`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    // Add ordering and pagination
    query += ` ORDER BY u.stream_started_at_v2 DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);

    const result = await sql.query(query, queryParams);
    const streams = result.rows;

    // Get additional information for each stream
    const enrichedStreams = await Promise.all(
      streams.map(async stream => {
        // Get stream health
        let streamHealth = null;
        try {
          streamHealth = await livepeerService.getStreamHealth(
            stream.livepeer_stream_id_v2
          );
        } catch (healthError) {
          console.warn(
            `Failed to get health for stream ${stream.livepeer_stream_id_v2}:`,
            healthError
          );
        }

        // Get playback info
        let playbackInfo = null;
        try {
          playbackInfo = await livepeerService.getPlaybackInfo(
            stream.playback_id_v2
          );
        } catch (playbackError) {
          console.warn(
            `Failed to get playback info for stream ${stream.playback_id_v2}:`,
            playbackError
          );
        }

        return {
          streamId: stream.livepeer_stream_id_v2,
          playbackId: stream.playback_id_v2,
          isLive: stream.is_live_v2,
          startedAt: stream.stream_started_at_v2,
          title: stream.stream_title_v2 || "",
          description: stream.stream_description_v2 || "",
          category: stream.stream_category_v2 || "",
          tags: stream.stream_tags_v2 || [],
          creator: {
            username: stream.username,
            wallet: stream.wallet,
          },
          playbackInfo: playbackInfo,
          health: streamHealth,
        };
      })
    );

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE u.is_live_v2 = true 
        AND u.livepeer_stream_id_v2 IS NOT NULL 
        AND u.playback_id_v2 IS NOT NULL
    `;

    const countParams: any[] = [];
    let countParamCount = 1;

    if (category) {
      countQuery += ` AND u.stream_category_v2 = $${countParamCount}`;
      countParams.push(category);
      countParamCount++;
    }

    if (search) {
      countQuery += ` AND (
        u.username ILIKE $${countParamCount} OR 
        u.stream_title_v2 ILIKE $${countParamCount} OR
        u.stream_description_v2 ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await sql.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || "0");

    return NextResponse.json({
      success: true,
      streams: enrichedStreams,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filters: {
        category: category || null,
        search: search || null,
      },
    });
  } catch (error) {
    console.error("Live streams error:", error);
    return NextResponse.json(
      { error: "Failed to get live streams" },
      { status: 500 }
    );
  }
}
