/**
 * Test suite for ReactionRateLimiter
 */

import { ReactionRateLimiter, REACTION_LIMITER_CONFIG } from "@/lib/reactions/rate-limiter";

describe("ReactionRateLimiter", () => {
  let limiter: ReactionRateLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    limiter = new ReactionRateLimiter(REACTION_LIMITER_CONFIG);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should allow initial burst", () => {
    const userId = "user-1";
    const streamId = "stream-1";
    const reactionType = "heart";

    // Should allow 20 rapid reactions (capacity)
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume(userId, streamId, reactionType)).toBe(true);
    }

    // 21st should be rate-limited
    expect(limiter.tryConsume(userId, streamId, reactionType)).toBe(false);
  });

  it("should refill tokens over time", () => {
    const userId = "user-1";
    const streamId = "stream-1";
    const reactionType = "heart";

    // Exhaust tokens
    for (let i = 0; i < 20; i++) {
      limiter.tryConsume(userId, streamId, reactionType);
    }

    // Should be rate-limited now
    expect(limiter.tryConsume(userId, streamId, reactionType)).toBe(false);

    // Advance time by 5 seconds (should refill ~5 tokens at 1/sec)
    jest.advanceTimersByTime(5000);

    // Should allow 5 more reactions
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume(userId, streamId, reactionType)).toBe(true);
    }

    // 6th should be limited
    expect(limiter.tryConsume(userId, streamId, reactionType)).toBe(false);
  });

  it("should never exceed max burst", () => {
    const userId = "user-1";
    const streamId = "stream-1";
    const reactionType = "heart";

    // Consume all tokens
    for (let i = 0; i < 20; i++) {
      limiter.tryConsume(userId, streamId, reactionType);
    }

    // Advance time by 100 seconds (would add 100 tokens, but capped at maxBurst)
    jest.advanceTimersByTime(100000);

    // Should still only have 20 tokens max
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume(userId, streamId, reactionType)).toBe(true);
    }

    expect(limiter.tryConsume(userId, streamId, reactionType)).toBe(false);
  });

  it("should track different reaction types separately", () => {
    const userId = "user-1";
    const streamId = "stream-1";

    // Exhaust hearts
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume(userId, streamId, "heart")).toBe(true);
    }
    expect(limiter.tryConsume(userId, streamId, "heart")).toBe(false);

    // Laughs should have full capacity
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume(userId, streamId, "laugh")).toBe(true);
    }
    expect(limiter.tryConsume(userId, streamId, "laugh")).toBe(false);
  });

  it("should track different users separately", () => {
    const streamId = "stream-1";
    const reactionType = "heart";

    // User 1 exhausts budget
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume("user-1", streamId, reactionType)).toBe(true);
    }

    // User 2 should have full budget
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume("user-2", streamId, reactionType)).toBe(true);
    }

    expect(limiter.tryConsume("user-1", streamId, reactionType)).toBe(false);
    expect(limiter.tryConsume("user-2", streamId, reactionType)).toBe(false);
  });

  it("should return correct remaining tokens", () => {
    const userId = "user-1";
    const streamId = "stream-1";
    const reactionType = "heart";

    // Initial: 20 tokens
    expect(Math.floor(limiter.getRemaining(userId, streamId, reactionType))).toBe(20);

    // Consume 5
    for (let i = 0; i < 5; i++) {
      limiter.tryConsume(userId, streamId, reactionType);
    }

    // Remaining: 15
    expect(Math.floor(limiter.getRemaining(userId, streamId, reactionType))).toBe(15);

    // Advance 3 seconds (refill 3 tokens)
    jest.advanceTimersByTime(3000);

    // Remaining: 18
    expect(Math.floor(limiter.getRemaining(userId, streamId, reactionType))).toBe(18);
  });

  it("should support reset", () => {
    const userId = "user-1";
    const streamId = "stream-1";
    const reactionType = "heart";

    // Exhaust tokens
    for (let i = 0; i < 20; i++) {
      limiter.tryConsume(userId, streamId, reactionType);
    }

    expect(limiter.tryConsume(userId, streamId, reactionType)).toBe(false);

    // Reset
    limiter.reset(userId, streamId, reactionType);

    // Should have full budget again
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume(userId, streamId, reactionType)).toBe(true);
    }
  });

  it("should handle legitimate rapid-tap scenarios", () => {
    const userId = "user-1";
    const streamId = "stream-1";

    // Simulate user rapidly tapping the heart button 15 times in 1 second
    // This should be allowed (within burst capacity)
    for (let i = 0; i < 15; i++) {
      expect(limiter.tryConsume(userId, streamId, "heart")).toBe(true);
    }

    // Advance 0.5 seconds and try again
    jest.advanceTimersByTime(500);

    // Still exhausted, not enough refill
    expect(limiter.tryConsume(userId, streamId, "heart")).toBe(false);

    // Advance another 3.5 seconds (total 4 sec, refill ~4 tokens)
    jest.advanceTimersByTime(3500);

    // Should allow 4 more
    for (let i = 0; i < 4; i++) {
      expect(limiter.tryConsume(userId, streamId, "heart")).toBe(true);
    }
  });

  it("should block abusive flood patterns", () => {
    const userId = "attacker";
    const streamId = "stream-1";

    // Burst 20 (allowed)
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume(userId, streamId, "heart")).toBe(true);
    }

    // Try to spam every 10ms for 5 seconds
    let successCount = 0;
    for (let i = 0; i < 500; i++) {
      if (limiter.tryConsume(userId, streamId, "heart")) {
        successCount++;
      }
      jest.advanceTimersByTime(10);
    }

    // Should only allow ~50 over 5 seconds (20 burst + 5 seconds * 1 token/sec refill)
    // Not 500
    expect(successCount).toBeLessThan(100);
    expect(successCount).toBeGreaterThan(20);
  });
});
