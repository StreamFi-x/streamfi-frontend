/**
 * Tests for metrics analyzer - focus on boundary conditions and edge cases
 */

import { analyzeMetrics } from "@/lib/diagnostics/metrics-analyzer";

describe("lib/diagnostics/metrics-analyzer", () => {
  describe("bitrate stability classification", () => {
    it("classifies excellent bitrate (< 5% variance)", () => {
      const result = analyzeMetrics(5000, 5000, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.bitrate.stability).toBe("excellent");
      expect(result.bitrate.variance).toBe(0);
    });

    it("classifies excellent bitrate at 4.9% variance", () => {
      const targetBitrate = 5000;
      const actualBitrate = Math.round(targetBitrate * 0.951);
      const result = analyzeMetrics(
        targetBitrate,
        actualBitrate,
        100,
        0,
        2000,
        2000,
        25,
        5,
        0
      );
      expect(result.bitrate.stability).toBe("excellent");
    });

    it("classifies good bitrate (5-15% variance)", () => {
      const result = analyzeMetrics(5000, 4650, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.bitrate.stability).toBe("good");
    });

    it("classifies marginal bitrate at boundary (15% variance)", () => {
      const result = analyzeMetrics(5000, 4250, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.bitrate.stability).toBe("marginal");
    });

    it("classifies marginal bitrate (15-30% variance)", () => {
      const result = analyzeMetrics(5000, 3750, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.bitrate.stability).toBe("marginal");
    });

    it("classifies poor bitrate (> 30% variance)", () => {
      const result = analyzeMetrics(5000, 3000, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.bitrate.stability).toBe("poor");
    });
  });

  describe("frame drop rate classification", () => {
    it("handles zero dropped frames", () => {
      const result = analyzeMetrics(5000, 5000, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.frames.dropRate).toBe(0);
    });

    it("calculates drop rate correctly", () => {
      const result = analyzeMetrics(5000, 5000, 100, 10, 2000, 2000, 25, 5, 0);
      expect(result.frames.dropRate).toBe(10);
    });

    it("handles all frames dropped", () => {
      const result = analyzeMetrics(5000, 5000, 100, 100, 2000, 2000, 25, 5, 0);
      expect(result.frames.dropRate).toBe(100);
    });

    it("handles edge case of one frame total", () => {
      const result = analyzeMetrics(5000, 5000, 1, 0, 2000, 2000, 25, 5, 0);
      expect(result.frames.dropRate).toBe(0);
    });

    it("handles edge case of one frame dropped from one total", () => {
      const result = analyzeMetrics(5000, 5000, 1, 1, 2000, 2000, 25, 5, 0);
      expect(result.frames.dropRate).toBe(100);
    });
  });

  describe("keyframe compliance", () => {
    it("marks keyframes compliant when interval is correct", () => {
      const result = analyzeMetrics(5000, 5000, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.keyframes.compliant).toBe(true);
    });

    it("marks keyframes compliant within 10% deviation", () => {
      const result = analyzeMetrics(5000, 5000, 100, 0, 2000, 2090, 25, 5, 0);
      expect(result.keyframes.compliant).toBe(true);
    });

    it("marks keyframes non-compliant outside 10% deviation", () => {
      const result = analyzeMetrics(5000, 5000, 100, 0, 2000, 2250, 25, 5, 0);
      expect(result.keyframes.compliant).toBe(false);
    });

    it("handles zero keyframe interval edge case", () => {
      const result = analyzeMetrics(5000, 5000, 100, 0, 0, 0, 25, 5, 0);
      expect(result.keyframes.compliant).toBe(true); // Both zero = match
    });
  });

  describe("network quality metrics", () => {
    it("captures latency accurately", () => {
      const result = analyzeMetrics(5000, 5000, 100, 0, 2000, 2000, 50, 5, 0);
      expect(result.networkQuality.latency).toBe(50);
    });

    it("captures jitter accurately", () => {
      const result = analyzeMetrics(5000, 5000, 100, 0, 2000, 2000, 25, 15, 0);
      expect(result.networkQuality.jitter).toBe(15);
    });

    it("captures packet loss accurately", () => {
      const result = analyzeMetrics(5000, 5000, 100, 0, 2000, 2000, 25, 5, 2.5);
      expect(result.networkQuality.packetLoss).toBe(2.5);
    });
  });

  describe("overall health scoring", () => {
    it("rates excellent metrics as good health", () => {
      const result = analyzeMetrics(
        5000, // target
        5000, // actual (0% variance)
        100, // total frames
        0, // dropped frames (0% drop)
        2000, // expected keyframe
        2000, // actual keyframe (0% deviation)
        25, // latency
        5, // jitter
        0 // packet loss
      );
      expect(result.health.status).toBe("good");
      expect(result.health.confidence).toBeGreaterThan(0.9);
    });

    it("rates marginal metrics as marginal health", () => {
      const result = analyzeMetrics(
        5000, // target
        4400, // actual (12% variance - marginal)
        100, // total frames
        2, // dropped frames (~2% drop - marginal)
        2000, // expected keyframe
        2050, // actual keyframe (2.5% deviation - good)
        50, // latency
        10, // jitter
        0 // packet loss
      );
      expect(result.health.status).toBe("marginal");
    });

    it("rates poor metrics as poor health", () => {
      const result = analyzeMetrics(
        5000, // target
        2500, // actual (50% variance - poor)
        100, // total frames
        20, // dropped frames (20% drop - poor)
        2000, // expected keyframe
        3000, // actual keyframe (50% deviation - poor)
        200, // latency
        30, // jitter
        5 // packet loss
      );
      expect(result.health.status).toBe("poor");
      expect(result.health.confidence).toBeLessThan(0.7);
    });

    it("maintains minimum confidence floor", () => {
      const result = analyzeMetrics(1, 100000, 1, 1, 1, 100000, 1000, 200, 50);
      expect(result.health.confidence).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe("edge cases", () => {
    it("handles all zeros", () => {
      const result = analyzeMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0);
      expect(result.bitrate).toBeDefined();
      expect(result.frames).toBeDefined();
      expect(result.keyframes).toBeDefined();
      expect(result.health).toBeDefined();
    });

    it("handles very small numbers", () => {
      const result = analyzeMetrics(1, 1, 1, 0, 1, 1, 1, 1, 0);
      expect(result.bitrate.variance).toBe(0);
      expect(result.frames.dropRate).toBe(0);
    });

    it("handles very large numbers", () => {
      const result = analyzeMetrics(100000, 100000, 1000000, 0, 5000, 5000, 100, 20, 0);
      expect(result.bitrate.stability).toBe("excellent");
      expect(result.frames.dropRate).toBe(0);
    });
  });

  describe("variance calculations", () => {
    it("rounds variance to 2 decimal places", () => {
      const result = analyzeMetrics(3000, 3042, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.bitrate.variance).toBe(1.4); // 42/3000 = 0.014 = 1.4%
    });

    it("handles positive variance (overShoot)", () => {
      const result = analyzeMetrics(5000, 5500, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.bitrate.variance).toBe(10);
    });

    it("handles negative variance (undershoot)", () => {
      const result = analyzeMetrics(5000, 4500, 100, 0, 2000, 2000, 25, 5, 0);
      expect(result.bitrate.variance).toBe(10);
    });
  });
});
