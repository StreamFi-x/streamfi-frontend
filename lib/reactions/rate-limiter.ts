/**
 * Burst-tolerant rate limiter for reactions
 * Token bucket algorithm optimized for rapid bursts rather than steady-state traffic
 */

export interface RateLimiterConfig {
  // Initial tokens in bucket
  capacity: number;
  // Tokens refilled per second
  refillRate: number;
  // Maximum burst size (tokens available at once)
  maxBurst: number;
}

// Default config: allows 20 rapid taps, refills at 1 per second
// This allows ~20 heart taps instantly, then 1 per second sustained
export const REACTION_LIMITER_CONFIG: RateLimiterConfig = {
  capacity: 20, // Start with 20 tokens
  refillRate: 1, // Add 1 token per second
  maxBurst: 20, // Never exceed 20 tokens
};

export interface TokenBucket {
  tokens: number;
  lastRefillTime: number;
}

/**
 * Token bucket rate limiter per user per stream
 */
export class ReactionRateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private config: RateLimiterConfig;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...REACTION_LIMITER_CONFIG, ...config };
  }

  /**
   * Generate key for user + stream + reaction type
   */
  private getKey(userId: string, streamId: string, reactionType: string): string {
    return `${userId}:${streamId}:${reactionType}`;
  }

  /**
   * Try to consume a reaction. Returns true if allowed, false if rate-limited
   */
  tryConsume(userId: string, streamId: string, reactionType: string): boolean {
    const key = this.getKey(userId, streamId, reactionType);
    let bucket = this.buckets.get(key);

    if (!bucket) {
      // First reaction from this user on this stream
      bucket = {
        tokens: this.config.capacity,
        lastRefillTime: Date.now(),
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * this.config.refillRate;

    bucket.tokens = Math.min(
      bucket.tokens + tokensToAdd,
      this.config.maxBurst
    );
    bucket.lastRefillTime = now;

    // Try to consume 1 token
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get remaining tokens for a user (for debugging/monitoring)
   */
  getRemaining(userId: string, streamId: string, reactionType: string): number {
    const key = this.getKey(userId, streamId, reactionType);
    const bucket = this.buckets.get(key);

    if (!bucket) {
      return this.config.capacity;
    }

    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * this.config.refillRate;
    return Math.min(bucket.tokens + tokensToAdd, this.config.maxBurst);
  }

  /**
   * Reset a user's bucket (admin use)
   */
  reset(userId: string, streamId: string, reactionType?: string) {
    if (reactionType) {
      const key = this.getKey(userId, streamId, reactionType);
      this.buckets.delete(key);
    } else {
      // Reset all reaction types for this user on this stream
      const prefix = `${userId}:${streamId}:`;
      for (const [key] of this.buckets.entries()) {
        if (key.startsWith(prefix)) {
          this.buckets.delete(key);
        }
      }
    }
  }

  /**
   * Cleanup stale buckets (call periodically to prevent memory growth)
   */
  cleanup(maxAgeMs: number = 3600000) {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefillTime > maxAgeMs) {
        this.buckets.delete(key);
      }
    }
  }
}

// Singleton instance
let limiter: ReactionRateLimiter | null = null;

export function getReactionLimiter(config?: Partial<RateLimiterConfig>): ReactionRateLimiter {
  if (!limiter) {
    limiter = new ReactionRateLimiter(config);
  }
  return limiter;
}
