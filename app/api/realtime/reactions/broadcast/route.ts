/**
 * POST /api/realtime/reactions/broadcast
 * Endpoint for aggregating and broadcasting reaction counts
 * Called periodically (e.g., every 200ms) to batch-publish aggregated reactions
 * 
 * This is designed for internal/cron job use or background worker integration
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecentMessages, publishRealtimeMessage } from "@/lib/realtime/pubsub";
import { logger } from "@/lib/tracing/logger";

export const config = {
  maxDuration: 30,
};

interface ReactionAggregation {
  [reactionType: string]: number;
}

export async function POST(request: NextRequest) {
  try {
    // Optional: verify this came from a trusted source (cron job, internal)
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { streamId } = await request.json();

    if (!streamId) {
      return NextResponse.json(
        { error: "Missing streamId" },
        { status: 400 }
      );
    }

    // Get recent reactions from the realtime channel
    const reactionChannel = `stream:${streamId}:reactions`;
    const recentReactions = await getRecentMessages(reactionChannel);

    if (recentReactions.length === 0) {
      return NextResponse.json({
        success: true,
        aggregated: {},
        eventCount: 0,
      });
    }

    // Aggregate reaction counts by type
    const aggregation: ReactionAggregation = {};

    for (const msg of recentReactions) {
      if (msg.event === "reaction" && msg.data?.type) {
        const reactionType = msg.data.type;
        aggregation[reactionType] = (aggregation[reactionType] || 0) + 1;
      }
    }

    // Broadcast aggregated counts on a separate channel
    // Viewers subscribe to this channel and render based on counts, not individual events
    const aggregatedChannel = `stream:${streamId}:reactions:aggregated`;

    if (Object.keys(aggregation).length > 0) {
      await publishRealtimeMessage(aggregatedChannel, "reactions:batch", {
        reactions: aggregation,
        timestamp: Date.now(),
        eventCount: recentReactions.length,
      });

      logger.debug("[reactions-broadcast] Batch published", {
        streamId,
        eventCount: recentReactions.length,
        reactionTypes: Object.keys(aggregation),
      });
    }

    return NextResponse.json({
      success: true,
      aggregated: aggregation,
      eventCount: recentReactions.length,
    });
  } catch (error) {
    logger.error("[reactions-broadcast] Failed to broadcast", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to broadcast reactions" },
      { status: 500 }
    );
  }
}
