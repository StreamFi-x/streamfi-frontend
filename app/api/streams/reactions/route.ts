/**
 * POST /api/streams/reactions
 * Endpoint for clients to send reactions
 * Applies rate limiting, records event, and triggers aggregation
 */

import { NextRequest, NextResponse } from "next/server";
import { getReactionLimiter } from "@/lib/reactions/rate-limiter";
import { recordReactionMetric } from "@/lib/reactions/aggregator";
import { publishRealtimeMessage } from "@/lib/realtime/pubsub";
import { logger } from "@/lib/tracing/logger";

export const config = {
  maxDuration: 10,
};

interface ReactionRequest {
  streamId: string;
  reactionType: string;
  viewerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ReactionRequest = await request.json();
    const { streamId, reactionType, viewerId = "anonymous" } = body;

    // Validate inputs
    if (!streamId || !reactionType) {
      return NextResponse.json(
        { error: "Missing streamId or reactionType" },
        { status: 400 }
      );
    }

    // Validate reaction type
    const validTypes = ["heart", "laugh", "wow", "fire", "clap"];
    if (!validTypes.includes(reactionType)) {
      return NextResponse.json(
        { error: "Invalid reaction type" },
        { status: 400 }
      );
    }

    // Apply rate limiting (burst-tolerant)
    const limiter = getReactionLimiter();
    const allowed = limiter.tryConsume(viewerId, streamId, reactionType);

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limited", remaining: 0 },
        { status: 429 }
      );
    }

    // Record metric for analytics (async, non-blocking)
    recordReactionMetric({
      userId: viewerId,
      streamId,
      reactionType,
      timestamp: Date.now(),
    }).catch((err) => {
      logger.debug("[reactions] Metric recording failed", { streamId, error: String(err) });
    });

    // Publish to realtime reactions channel
    // The server aggregates these and broadcasts counts periodically
    // (not persisted to history, purely ephemeral)
    const reactionChannel = `stream:${streamId}:reactions`;
    
    publishRealtimeMessage(reactionChannel, "reaction", {
      type: reactionType,
      viewerId,
      timestamp: Date.now(),
    }).catch((err) => {
      logger.warn("[reactions] Failed to publish realtime event", {
        streamId,
        error: String(err),
      });
    });

    const remaining = limiter.getRemaining(viewerId, streamId, reactionType);

    return NextResponse.json({
      success: true,
      remaining: Math.floor(remaining),
    });
  } catch (error) {
    logger.error("[reactions] Failed to process reaction", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to process reaction" },
      { status: 500 }
    );
  }
}
