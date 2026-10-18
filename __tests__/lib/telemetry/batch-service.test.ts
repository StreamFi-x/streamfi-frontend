/**
 * Test suite for TelemetryBatchService
 */

import { TelemetryBatchService } from "@/lib/telemetry/batch-service";
import { PlaybackEventCollector } from "@/lib/telemetry/event-collector";

// Mock fetch
global.fetch = jest.fn();

describe("TelemetryBatchService", () => {
  let service: TelemetryBatchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TelemetryBatchService({
      maxEvents: 10,
      flushIntervalMs: 1000,
      endpoint: "/api/telemetry/events",
    });
  });

  afterEach(() => {
    service.destroy();
  });

  it("should initialize with default config", () => {
    const defaultService = new TelemetryBatchService();
    expect(defaultService).toBeDefined();
    defaultService.destroy();
  });

  it("should batch events", () => {
    const collector = new PlaybackEventCollector("stream-1", "viewer-1", "session-1");
    service.registerCollector("session-1", collector);

    collector.recordPlayerMount();
    collector.recordFirstFrame();

    const events = collector.getEvents();
    service.addEvents("session-1", events);

    // Events should be batched, not sent immediately
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should flush when batch size threshold is reached", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const collector = new PlaybackEventCollector("stream-1", "viewer-1", "session-1");
    service.registerCollector("session-1", collector);

    // Create 11 events (exceeds maxEvents of 10)
    for (let i = 0; i < 11; i++) {
      collector.recordError(`ERROR_${i}`, `Error ${i}`);
    }

    const events = collector.getEvents();
    service.addEvents("session-1", events);

    // Should have flushed
    expect(fetch).toHaveBeenCalled();

    const call = (fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe("/api/telemetry/events");
    expect(call[1].method).toBe("POST");
  });

  it("should use sendBeacon on unload", () => {
    const sendBeaconMock = jest.fn();
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeaconMock,
      writable: true,
    });

    const collector = new PlaybackEventCollector("stream-1", "viewer-1", "session-1");
    service.registerCollector("session-1", collector);

    collector.recordError("TEST", "test");
    service.flushOnUnload("session-1");

    expect(sendBeaconMock).toHaveBeenCalled();
  });
});
