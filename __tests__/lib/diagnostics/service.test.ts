/**
 * Tests for diagnostic service - orchestration and error handling
 */

import { runDiagnostics } from "@/lib/diagnostics/service";

// Mock dependencies
jest.mock("@/lib/mux/server", () => ({
  createMuxStream: jest.fn().mockResolvedValue({
    id: "test-stream-123",
    streamKey: "test-key",
    playbackId: "test-playback",
    status: "active",
    rtmpUrl: "rtmp://test",
  }),
}));

jest.mock("@/lib/diagnostics/mux-ingest-simulator", () => ({
  sendTestFrames: jest.fn().mockResolvedValue({
    totalBytes: 15000000,
    totalFrames: 360,
    droppedFrames: 0,
    averageBitrate: 5000,
    testDurationMs: 12000,
    keyframeInterval: 2000,
  }),
  collectMuxMetrics: jest.fn().mockResolvedValue({
    averageBitrate: 5000,
  }),
  deleteMuxStream: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("lib/diagnostics/service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("runDiagnostics", () => {
    it("returns diagnostic results for healthy stream", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const results = await runDiagnostics(encoder, "user-123");

      expect(results).toHaveProperty("bitrate");
      expect(results).toHaveProperty("frames");
      expect(results).toHaveProperty("keyframes");
      expect(results).toHaveProperty("networkQuality");
      expect(results).toHaveProperty("health");
      expect(results).toHaveProperty("timestamp");

      expect(results.bitrate.target).toBe(5000);
      expect(results.health.status).toBe("good");
    });

    it("creates a temporary test stream", async () => {
      const { createMuxStream } = require("@/lib/mux/server");
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      await runDiagnostics(encoder, "user-123");

      expect(createMuxStream).toHaveBeenCalled();
    });

    it("sends test frames", async () => {
      const { sendTestFrames } = require("@/lib/diagnostics/mux-ingest-simulator");
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      await runDiagnostics(encoder, "user-123");

      expect(sendTestFrames).toHaveBeenCalled();
    });

    it("collects Mux metrics", async () => {
      const { collectMuxMetrics } = require("@/lib/diagnostics/mux-ingest-simulator");
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      await runDiagnostics(encoder, "user-123");

      expect(collectMuxMetrics).toHaveBeenCalled();
    });

    it("deletes test stream after diagnostics", async () => {
      const { deleteMuxStream } = require("@/lib/diagnostics/mux-ingest-simulator");
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      await runDiagnostics(encoder, "user-123");

      expect(deleteMuxStream).toHaveBeenCalledWith("test-stream-123");
    });

    it("deletes stream even if diagnostics fail", async () => {
      const { createMuxStream, sendTestFrames } = require("@/lib/diagnostics/mux-ingest-simulator");
      const { deleteMuxStream } = require("@/lib/diagnostics/mux-ingest-simulator");

      sendTestFrames.mockRejectedValueOnce(new Error("Frame send failed"));

      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      await runDiagnostics(encoder, "user-123");

      expect(deleteMuxStream).toHaveBeenCalled();
    });

    it("returns fallback results on service failure", async () => {
      const { createMuxStream } = require("@/lib/mux/server");
      createMuxStream.mockRejectedValueOnce(new Error("Mux unavailable"));

      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const results = await runDiagnostics(encoder, "user-123");

      expect(results).toBeDefined();
      expect(results.health.status).toBe("poor");
      expect(results.health.confidence).toBeLessThan(0.2);
    });

    it("handles different encoder settings", async () => {
      const result1 = await runDiagnostics(
        {
          bitrate: 3000,
          resolution: "1280x720",
          keyframeIntervalMs: 2000,
        },
        "user-123"
      );

      expect(result1.bitrate.target).toBe(3000);

      const result2 = await runDiagnostics(
        {
          bitrate: 8000,
          resolution: "1920x1080",
          keyframeIntervalMs: 3000,
        },
        "user-456"
      );

      expect(result2.bitrate.target).toBe(8000);
    });

    it("handles diagnostics without userId", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const results = await runDiagnostics(encoder);

      expect(results).toBeDefined();
      expect(results.health).toBeDefined();
    });

    it("returns timestamp in ISO format", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const results = await runDiagnostics(encoder, "user-123");

      expect(results.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("includes frame metrics from test", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const results = await runDiagnostics(encoder, "user-123");

      expect(results.frames.total).toBe(360); // From mock
      expect(results.frames.dropped).toBe(0); // From mock
    });

    it("includes keyframe metrics from test", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const results = await runDiagnostics(encoder, "user-123");

      expect(results.keyframes.expectedInterval).toBe(2000);
      expect(results.keyframes.interval).toBe(2000);
    });
  });

  describe("error handling and graceful degradation", () => {
    it("provides service-unavailable-like results when Mux is down", async () => {
      const { createMuxStream } = require("@/lib/mux/server");
      createMuxStream.mockRejectedValueOnce(new Error("503 Service Unavailable"));

      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const results = await runDiagnostics(encoder, "user-123");

      // Should return poor health with low confidence
      expect(results.health.status).toBe("poor");
      expect(results.health.confidence).toBeLessThan(0.2);

      // Values should indicate no data collected
      expect(results.bitrate.actual).toBe(0);
    });

    it("handles timeout during frame sending", async () => {
      const { sendTestFrames } = require("@/lib/diagnostics/mux-ingest-simulator");
      sendTestFrames.mockRejectedValueOnce(new Error("Timeout"));

      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const results = await runDiagnostics(encoder, "user-123");

      expect(results.health.status).toBe("poor");
    });
  });
});
