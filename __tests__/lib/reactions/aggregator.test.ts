/**
 * Test suite for ReactionAggregator
 */

import { ReactionAggregator } from "@/lib/reactions/aggregator";

describe("ReactionAggregator", () => {
  let aggregator: ReactionAggregator;

  beforeEach(() => {
    jest.useFakeTimers();
    aggregator = new ReactionAggregator(200); // 200ms flush interval
  });

  afterEach(() => {
    jest.useRealTimers();
    aggregator.destroy();
  });

  it("should aggregate reactions by type", async () => {
    const flushed: any[] = [];
    aggregator.setOnFlush(async (streamId, reactions) => {
      flushed.push({ streamId, reactions });
    });

    aggregator.start();

    // Add 5 hearts
    for (let i = 0; i < 5; i++) {
      aggregator.addReaction({
        userId: "user-1",
        streamId: "stream-1",
        reactionType: "heart",
        timestamp: Date.now(),
      });
    }

    // Add 3 laughs
    for (let i = 0; i < 3; i++) {
      aggregator.addReaction({
        userId: "user-2",
        streamId: "stream-1",
        reactionType: "laugh",
        timestamp: Date.now(),
      });
    }

    // Advance past flush interval
    jest.advanceTimersByTime(300);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(flushed.length).toBe(1);
    expect(flushed[0].streamId).toBe("stream-1");
    expect(flushed[0].reactions).toEqual([
      { reactionType: "heart", count: 5, lastUpdate: expect.any(Number) },
      { reactionType: "laugh", count: 3, lastUpdate: expect.any(Number) },
    ]);
  });

  it("should handle multiple streams separately", async () => {
    const flushed: any[] = [];
    aggregator.setOnFlush(async (streamId, reactions) => {
      flushed.push({ streamId, reactions });
    });

    aggregator.start();

    aggregator.addReaction({
      userId: "user-1",
      streamId: "stream-1",
      reactionType: "heart",
      timestamp: Date.now(),
    });

    aggregator.addReaction({
      userId: "user-2",
      streamId: "stream-2",
      reactionType: "fire",
      timestamp: Date.now(),
    });

    jest.advanceTimersByTime(300);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(flushed.length).toBe(2);
    expect(flushed.map((f) => f.streamId)).toEqual(["stream-1", "stream-2"]);
  });

  it("should flush on interval", async () => {
    let flushCount = 0;
    aggregator.setOnFlush(async () => {
      flushCount++;
    });

    aggregator.start();

    aggregator.addReaction({
      userId: "user-1",
      streamId: "stream-1",
      reactionType: "heart",
      timestamp: Date.now(),
    });

    // First flush
    jest.advanceTimersByTime(300);
    await new Promise((resolve) => setTimeout(resolve, 0));

    aggregator.addReaction({
      userId: "user-1",
      streamId: "stream-1",
      reactionType: "heart",
      timestamp: Date.now(),
    });

    // Second flush
    jest.advanceTimersByTime(300);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(flushCount).toBe(2);
  });

  it("should clear aggregates after flush", async () => {
    let flushed: any[] = [];
    aggregator.setOnFlush(async (streamId, reactions) => {
      flushed.push({ streamId, reactions });
    });

    aggregator.addReaction({
      userId: "user-1",
      streamId: "stream-1",
      reactionType: "heart",
      timestamp: Date.now(),
    });

    jest.advanceTimersByTime(300);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(flushed[0].reactions[0].count).toBe(1);

    // Reset and add new reactions
    flushed = [];

    aggregator.addReaction({
      userId: "user-1",
      streamId: "stream-1",
      reactionType: "heart",
      timestamp: Date.now(),
    });

    // Should be count 1, not 2
    jest.advanceTimersByTime(300);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(flushed[0].reactions[0].count).toBe(1);
  });

  it("should handle high-volume burst", async () => {
    const flushed: any[] = [];
    aggregator.setOnFlush(async (streamId, reactions) => {
      flushed.push({ streamId, reactions });
    });

    aggregator.start();

    // Simulate 1000 rapid reactions from different users on same stream
    for (let i = 0; i < 1000; i++) {
      const type = ["heart", "laugh", "fire", "wow", "clap"][i % 5];
      aggregator.addReaction({
        userId: `user-${i}`,
        streamId: "stream-1",
        reactionType: type,
        timestamp: Date.now(),
      });
    }

    jest.advanceTimersByTime(300);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(flushed.length).toBe(1);

    const reactionsMap: Record<string, number> = {};
    for (const reaction of flushed[0].reactions) {
      reactionsMap[reaction.reactionType] = reaction.count;
    }

    // Should have 200 of each type (1000 / 5)
    expect(reactionsMap["heart"]).toBe(200);
    expect(reactionsMap["laugh"]).toBe(200);
    expect(reactionsMap["fire"]).toBe(200);
    expect(reactionsMap["wow"]).toBe(200);
    expect(reactionsMap["clap"]).toBe(200);
  });

  it("should support manual flush", async () => {
    const flushed: any[] = [];
    aggregator.setOnFlush(async (streamId, reactions) => {
      flushed.push({ streamId, reactions });
    });

    aggregator.addReaction({
      userId: "user-1",
      streamId: "stream-1",
      reactionType: "heart",
      timestamp: Date.now(),
    });

    // Manual flush before interval
    await aggregator.flush();

    expect(flushed.length).toBe(1);
    expect(flushed[0].reactions[0].count).toBe(1);
  });

  it("should not flush empty aggregates", async () => {
    let flushCount = 0;
    aggregator.setOnFlush(async () => {
      flushCount++;
    });

    aggregator.start();

    // Don't add any reactions, just wait
    jest.advanceTimersByTime(300);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Callback should not be called
    expect(flushCount).toBe(0);
  });
});
