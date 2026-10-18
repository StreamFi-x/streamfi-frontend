/**
 * Tests for guidance generator - plain-language recommendations
 */

import { generateGuidance } from "@/lib/diagnostics/guidance-generator";
import { DiagnosticResults } from "@/lib/diagnostics/types";

describe("lib/diagnostics/guidance-generator", () => {
  describe("null/unavailable results", () => {
    it("returns service unavailable message for null results", () => {
      const { guidance, summary } = generateGuidance(null);
      expect(guidance).toHaveLength(1);
      expect(guidance[0].severity).toBe("warning");
      expect(summary).toBe("Service unavailable");
    });
  });

  describe("bitrate guidance", () => {
    it("recommends lowering bitrate for poor stability", () => {
      const results: DiagnosticResults = {
        bitrate: {
          target: 5000,
          actual: 2500,
          variance: 50,
          stability: "poor",
        },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "poor", confidence: 0.8 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const bitrateGuidance = guidance.find(g => g.message.includes("unstable"));
      expect(bitrateGuidance).toBeDefined();
      expect(bitrateGuidance?.severity).toBe("error");
      expect(bitrateGuidance?.message).toContain("2000"); // 2500 * 0.8 = 2000
    });

    it("warns for marginal bitrate", () => {
      const results: DiagnosticResults = {
        bitrate: {
          target: 5000,
          actual: 4250,
          variance: 15,
          stability: "marginal",
        },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "marginal", confidence: 0.8 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const bitrateGuidance = guidance.find(g => g.message.includes("marginal"));
      expect(bitrateGuidance).toBeDefined();
      expect(bitrateGuidance?.severity).toBe("warning");
    });

    it("confirms good bitrate", () => {
      const results: DiagnosticResults = {
        bitrate: {
          target: 5000,
          actual: 4900,
          variance: 2,
          stability: "good",
        },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "good", confidence: 0.95 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const bitrateGuidance = guidance.find(g => g.message.includes("stable"));
      expect(bitrateGuidance).toBeDefined();
      expect(bitrateGuidance?.severity).toBe("info");
      expect(bitrateGuidance?.message).toContain("✓");
    });

    it("encourages increasing bitrate when excellent", () => {
      const results: DiagnosticResults = {
        bitrate: {
          target: 5000,
          actual: 5000,
          variance: 0,
          stability: "excellent",
        },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "good", confidence: 1 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const bitrateGuidance = guidance.find(g => g.message.includes("excellent"));
      expect(bitrateGuidance).toBeDefined();
      expect(bitrateGuidance?.message).toContain("increase");
    });
  });

  describe("frame drop guidance", () => {
    it("errors on high frame drop rate", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 10, dropRate: 10 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "poor", confidence: 0.8 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const dropGuidance = guidance.find(g => g.message.includes("dropping"));
      expect(dropGuidance).toBeDefined();
      expect(dropGuidance?.severity).toBe("error");
    });

    it("warns on moderate frame drop", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 1000, dropped: 20, dropRate: 2 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "marginal", confidence: 0.85 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const dropGuidance = guidance.find(g => g.message.includes("drops"));
      expect(dropGuidance).toBeDefined();
      expect(dropGuidance?.severity).toBe("warning");
    });

    it("confirms no dropped frames", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 1000, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "good", confidence: 0.95 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const dropGuidance = guidance.find(g => g.message.includes("No dropped"));
      expect(dropGuidance).toBeDefined();
      expect(dropGuidance?.message).toContain("✓");
    });
  });

  describe("keyframe guidance", () => {
    it("errors on significant keyframe mismatch", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 3000, expectedInterval: 2000, compliant: false },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "poor", confidence: 0.8 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const keyframeGuidance = guidance.find(g => g.message.includes("Keyframe"));
      expect(keyframeGuidance).toBeDefined();
      expect(keyframeGuidance?.severity).toBe("error");
    });

    it("confirms keyframe compliance", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "good", confidence: 0.95 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const keyframeGuidance = guidance.find(g => g.message.includes("correct"));
      expect(keyframeGuidance).toBeDefined();
      expect(keyframeGuidance?.message).toContain("✓");
    });
  });

  describe("network quality guidance", () => {
    it("errors on high latency", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 200, jitter: 5, packetLoss: 0 },
        health: { status: "poor", confidence: 0.8 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const latencyGuidance = guidance.find(g => g.message.includes("latency"));
      expect(latencyGuidance).toBeDefined();
      expect(latencyGuidance?.severity).toBe("error");
    });

    it("warns on elevated latency", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 80, jitter: 5, packetLoss: 0 },
        health: { status: "marginal", confidence: 0.85 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const latencyGuidance = guidance.find(g => g.message.includes("Elevated"));
      expect(latencyGuidance).toBeDefined();
      expect(latencyGuidance?.severity).toBe("warning");
    });

    it("warns on high jitter", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 30, packetLoss: 0 },
        health: { status: "marginal", confidence: 0.8 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const jitterGuidance = guidance.find(g => g.message.includes("jitter"));
      expect(jitterGuidance).toBeDefined();
      expect(jitterGuidance?.severity).toBe("warning");
    });

    it("errors on packet loss", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 2 },
        health: { status: "poor", confidence: 0.8 },
        timestamp: new Date().toISOString(),
      };

      const { guidance } = generateGuidance(results);
      const packetGuidance = guidance.find(g => g.message.includes("Packet"));
      expect(packetGuidance).toBeDefined();
      expect(packetGuidance?.severity).toBe("error");
    });
  });

  describe("overall summary", () => {
    it("provides positive summary for good health", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "good", confidence: 0.95 },
        timestamp: new Date().toISOString(),
      };

      const { summary } = generateGuidance(results);
      expect(summary).toContain("healthy");
      expect(summary).toContain("🚀");
    });

    it("provides cautionary summary for marginal health", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 4400, variance: 12, stability: "marginal" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "marginal", confidence: 0.8 },
        timestamp: new Date().toISOString(),
      };

      const { summary } = generateGuidance(results);
      expect(summary).toContain("marginal");
    });

    it("provides error summary for poor health", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 2500, variance: 50, stability: "poor" },
        frames: { total: 100, dropped: 10, dropRate: 10 },
        keyframes: { interval: 3000, expectedInterval: 2000, compliant: false },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "poor", confidence: 0.7 },
        timestamp: new Date().toISOString(),
      };

      const { summary } = generateGuidance(results);
      expect(summary).toContain("issues");
    });

    it("notes low confidence", () => {
      const results: DiagnosticResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "good", confidence: 0.5 },
        timestamp: new Date().toISOString(),
      };

      const { summary } = generateGuidance(results);
      expect(summary).toContain("Low confidence");
      expect(summary).toContain("50%");
    });
  });
});
