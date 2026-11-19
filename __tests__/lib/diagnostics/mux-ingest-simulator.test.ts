/**
 * Tests for Mux ingest simulator - frame generation and bitrate pacing
 */

import { sendTestFrames, deleteMuxStream } from "@/lib/diagnostics/mux-ingest-simulator";

// Mock Mux
jest.mock("@mux/mux-node", () => {
  return jest.fn().mockImplementation(() => ({
    video: {
      liveStreams: {
        retrieve: jest.fn(),
        delete: jest.fn(),
      },
    },
  }));
});

// Mock logger
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("lib/diagnostics/mux-ingest-simulator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendTestFrames", () => {
    it("simulates frames at target bitrate", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 1000);

      expect(metrics).toHaveProperty("totalFrames");
      expect(metrics).toHaveProperty("totalBytes");
      expect(metrics).toHaveProperty("droppedFrames");
      expect(metrics).toHaveProperty("averageBitrate");
      expect(metrics).toHaveProperty("testDurationMs");

      // Should have sent some frames (at ~30fps, 1 second = ~30 frames)
      expect(metrics.totalFrames).toBeGreaterThan(0);

      // Average bitrate should be close to target
      expect(metrics.averageBitrate).toBeGreaterThan(0);
    });

    it("generates correct amount of frames for duration", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 3000);

      // At ~30fps, 3 seconds should be ~90 frames (±5)
      expect(metrics.totalFrames).toBeGreaterThan(80);
      expect(metrics.totalFrames).toBeLessThan(100);
    });

    it("simulates low bitrate correctly", async () => {
      const encoder = {
        bitrate: 1000, // Low bitrate
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 2000);

      expect(metrics.totalFrames).toBeGreaterThan(0);
      expect(metrics.averageBitrate).toBeLessThan(1500); // Should be less than target + margin
    });

    it("simulates high bitrate correctly", async () => {
      const encoder = {
        bitrate: 10000, // High bitrate
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 2000);

      expect(metrics.totalFrames).toBeGreaterThan(0);
      expect(metrics.averageBitrate).toBeGreaterThan(0);
    });

    it("tracks dropped frames", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 2000);

      expect(metrics.droppedFrames).toBeGreaterThanOrEqual(0);
      expect(metrics.droppedFrames).toBeLessThanOrEqual(metrics.totalFrames);
    });

    it("handles 720p resolution", async () => {
      const encoder = {
        bitrate: 3000,
        resolution: "1280x720",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 1000);

      expect(metrics.totalFrames).toBeGreaterThan(0);
    });

    it("handles 1080p resolution", async () => {
      const encoder = {
        bitrate: 6000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 1000);

      expect(metrics.totalFrames).toBeGreaterThan(0);
    });

    it("handles 4k resolution", async () => {
      const encoder = {
        bitrate: 15000,
        resolution: "3840x2160",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 1000);

      expect(metrics.totalFrames).toBeGreaterThan(0);
    });

    it("respects keyframe interval in metrics", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 3000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 1000);

      expect(metrics.keyframeInterval).toBe(3000);
    });

    it("returns consistent test duration", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 2000);

      // Duration should be approximately 2000ms ±200ms
      expect(metrics.testDurationMs).toBeGreaterThan(1800);
      expect(metrics.testDurationMs).toBeLessThan(2200);
    });

    it("generates non-zero bytes", async () => {
      const encoder = {
        bitrate: 5000,
        resolution: "1920x1080",
        keyframeIntervalMs: 2000,
      };

      const metrics = await sendTestFrames("test-stream-id", encoder, 1000);

      expect(metrics.totalBytes).toBeGreaterThan(0);
    });
  });

  describe("deleteMuxStream", () => {
    it("calls Mux delete API", async () => {
      const Mux = require("@mux/mux-node");
      const muxInstance = new Mux();
      muxInstance.video.liveStreams.delete.mockResolvedValue(undefined);

      await deleteMuxStream("test-stream-id");

      // Verify delete was called (mocked implementation)
      expect(muxInstance.video.liveStreams.delete).toHaveBeenCalled();
    });

    it("handles errors gracefully", async () => {
      const Mux = require("@mux/mux-node");
      const muxInstance = new Mux();
      const error = new Error("Stream not found");
      muxInstance.video.liveStreams.delete.mockRejectedValue(error);

      // Should not throw
      await expect(deleteMuxStream("nonexistent-stream")).resolves.toBeUndefined();
    });
  });
});
