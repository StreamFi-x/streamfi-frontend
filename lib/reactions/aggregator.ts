/**
 * Server-side reaction aggregator
 * Batches and samples high-frequency reactions for efficient broadcast
 */

import { getUpstashRedis } from "@/lib/upstash-redis";
import { logger } from "@/lib/tracing/logger";

export interface ReactionEvent {
  userId: string;
  streamId: string;
  reactionType: string; // 'heart', 'laugh', 'wow', etc.
  timestamp: number;
}

export interface AggregatedReaction {
  reactionType: string;
  count: number;
  lastUpdate: number;
}

/**
 * Aggregates reactions per stream into counts
 * Broadcasts periodically rather than per-event
 */
export class ReactionAggregator {
  private aggregates: Map<string, Map<string, number>> = new Map(); // streamId -> (reactionType -> count)
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly flushIntervalMs: number;
  private onFlush?: (streamId: string, reactions: AggregatedReaction[]) => Promise<void>;

  constructor(flushIntervalMs: number = 200) {
    this.flushIntervalMs = flushIntervalMs;
  }

  /**
   * Register callback for aggregated reactions ready to broadcast
   */
  setOnFlush(callback: (streamId: string, reactions: AggregatedReaction[]) => Promise<void>) {
    this.onFlush = callback;
  }

  /**
   * Add a reaction to the aggregate
   */
  addReaction(reaction: ReactionEvent) {
    const { streamId, reactionType } = reaction;

    let streamReactions = this.aggregates.get(streamId);
    if (!streamReactions) {
      streamReactions = new Map();
      this.aggregates.set(streamId, streamReactions);
    }

    const current = streamReactions.get(reactionType) || 0;
    streamReactions.set(reactionType, current + 1);
  }

  /**
   * Start auto-flushing aggregates
   */
  start() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Flush all aggregates and broadcast
   */
  async flush() {
    if (this.aggregates.size === 0) {
      return;
    }

    const toFlush = new Map(this.aggregates);
    this.aggregates.clear();

    for (const [streamId, reactions] of toFlush.entries()) {
      const aggregated: AggregatedReaction[] = Array.from(reactions.entries()).map(
        ([reactionType, count]) => ({
          reactionType,
          count,
          lastUpdate: Date.now(),
        })
      );

      try {
        if (this.onFlush) {
          await this.onFlush(streamId, aggregated);
        }
      } catch (error) {
        logger.warn("[reactions-aggregator] Flush callback failed", {
          streamId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Stop auto-flushing
   */
  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();
    this.aggregates.clear();
  }
}

/**
 * High-level reaction handler with redis persistence and aggregation
 */
export class ReactionHandler {
  private aggregator: ReactionAggregator;
  private readonly streamId: string;

  constructor(streamId: string, flushIntervalMs: number = 200) {
    this.streamId = streamId;
    this.aggregator = new ReactionAggregator(flushIntervalMs);
  }

  /**
   * Handle incoming reaction, aggregate it
   */
  handleReaction(reaction: ReactionEvent) {
    this.aggregator.addReaction(reaction);
  }

  /**
   * Set callback for flushed aggregates
   */
  setOnFlush(callback: (streamId: string, reactions: AggregatedReaction[]) => Promise<void>) {
    this.aggregator.setOnFlush(callback);
  }

  /**
   * Start aggregation
   */
  start() {
    this.aggregator.start();
  }

  /**
   * Stop aggregation
   */
  stop() {
    this.aggregator.stop();
  }

  /**
   * Manual flush
   */
  async flush() {
    await this.aggregator.flush();
  }

  /**
   * Cleanup
   */
  destroy() {
    this.aggregator.destroy();
  }
}

/**
 * Store reaction metrics for analytics (non-real-time, batch-inserted)
 */
export async function recordReactionMetric(reaction: ReactionEvent) {
  const redis = getUpstashRedis();
  if (!redis) {
    return; // Skip if no Redis
  }

  try {
    const key = `reactions:${reaction.streamId}:daily:${new Date().toISOString().split('T')[0]}`;
    const field = `${reaction.reactionType}:count`;

    // Increment daily counter per reaction type
    await redis.hincrby(key, field, 1);
    await redis.expire(key, 30 * 24 * 60 * 60); // 30 day TTL
  } catch (error) {
    logger.debug("[reactions] Failed to record metric", {
      streamId: reaction.streamId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
