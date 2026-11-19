/**
 * Test suite for PlaybackEventCollector
 */

import { PlaybackEventCollector } from "@/lib/telemetry/event-collector";

describe("PlaybackEventCollector", () => {
  let collector: PlaybackEventCollector;

  beforeEach(() => {
    collector = new PlaybackEventCollector("stream-123", "viewer-456", "session-789");
  });

  it("should record player mount", () => {
    collector.recordPlayerMount();
    // Verify internal state is initialized
    expect(collector).toBeDefined();
  });

  it("should record first frame and calculate startup time", () => {
    collector.recordPlayerMount();
    // Simulate 100ms delay
    jest.useFakeTimers();
    jest.advanceTimersByTime(100);
    collector.recordFirstFrame();

    const events = collector.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("startup");
    expect(events[0].data.startupTimeMs).toBeGreaterThan(0);

    jest.useRealTimers();
  });

  it("should track rebuffer events", () => {
    collector.recordPlayerMount();
    collector.recordRebufferStart();

    jest.useFakeTimers();
    jest.advanceTimersByTime(500); // 500ms rebuffer

    collector.recordRebufferEnd();

    const events = collector.getEvents();
    const rebufferEvent = events.find((e) => e.eventType === "rebuffer");

    expect(rebufferEvent).toBeDefined();
    expect(rebufferEvent?.data.durationMs).toBeGreaterThan(0);

    jest.useRealTimers();
  });

  it("should record errors", () => {
    collector.recordError("PLAYBACK_ERROR", "Buffer underrun", true);

    const events = collector.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("error");
    expect(events[0].data.errorCode).toBe("PLAYBACK_ERROR");
    expect(events[0].data.fatal).toBe(true);
  });

  it("should record quality changes", () => {
    collector.recordQualityChange("720p", "1080p", "auto");

    const events = collector.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("quality_change");
    expect(events[0].data.from).toBe("720p");
    expect(events[0].data.to).toBe("1080p");
  });

  it("should calculate rebuffer ratio on session end", () => {
    collector.recordPlayerMount();
    collector.recordFirstFrame();

    jest.useFakeTimers();

    // Simulate 5 seconds playback with 1 second of rebuffering
    jest.advanceTimersByTime(1000);
    collector.recordRebufferStart();
    jest.advanceTimersByTime(1000);
    collector.recordRebufferEnd();
    jest.advanceTimersByTime(3000);

    collector.recordSessionEnd();

    const metrics = collector.getSessionMetrics();
    expect(metrics.rebufferCount).toBe(1);
    expect(metrics.totalRebufferDurationMs).toBeGreaterThan(0);
    expect(metrics.rebufferRatio).toBeGreaterThan(0);
    expect(metrics.rebufferRatio).toBeLessThanOrEqual(1);

    jest.useRealTimers();
  });

  it("should clear events after retrieval", () => {
    collector.recordError("TEST", "test error");
    let events = collector.getEvents();
    expect(events.length).toBe(1);

    collector.clearEvents();
    events = collector.getEvents();
    expect(events.length).toBe(0);
  });
});
