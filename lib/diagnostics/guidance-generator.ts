/**
 * Transforms metrics into plain-language, actionable guidance
 */

import { DiagnosticResults, GuidanceItem } from "./types";

export function generateGuidance(results: DiagnosticResults | null): {
  guidance: GuidanceItem[];
  summary: string;
} {
  const guidance: GuidanceItem[] = [];

  if (!results) {
    return {
      guidance: [
        {
          message: "Diagnostics unavailable. Proceed at your discretion.",
          severity: "warning",
        },
      ],
      summary: "Service unavailable",
    };
  }

  // Bitrate guidance (highest priority)
  if (results.bitrate.stability === "poor") {
    const recommendedBitrate = Math.round(results.bitrate.actual * 0.8);
    guidance.push({
      message: `Your bitrate is unstable. Consider lowering it to ${recommendedBitrate} kbps or using a wired connection.`,
      severity: "error",
    });
  } else if (results.bitrate.stability === "marginal") {
    const recommendedBitrate = Math.round(results.bitrate.actual * 0.85);
    guidance.push({
      message: `Your bitrate is marginal. For better stability, try lowering it to ${recommendedBitrate} kbps.`,
      severity: "warning",
    });
  } else if (results.bitrate.stability === "good") {
    guidance.push({
      message: `Your bitrate is stable at ${results.bitrate.actual} kbps. ✓`,
      severity: "info",
    });
  } else if (results.bitrate.stability === "excellent") {
    guidance.push({
      message: `Your bitrate is excellent at ${results.bitrate.actual} kbps. You could increase it if desired. ✓`,
      severity: "info",
    });
  }

  // Frame drop guidance
  if (results.frames.dropRate > 5) {
    guidance.push({
      message: `Your encoder is dropping frames (${results.frames.dropRate.toFixed(1)}% drop rate). Check encoder settings or network quality.`,
      severity: "error",
    });
  } else if (results.frames.dropRate > 1) {
    guidance.push({
      message: `You're experiencing some frame drops (${results.frames.dropRate.toFixed(1)}%). Monitor your encoder and connection.`,
      severity: "warning",
    });
  } else if (results.frames.dropRate === 0) {
    guidance.push({
      message: `No dropped frames detected. ✓`,
      severity: "info",
    });
  }

  // Keyframe guidance
  if (!results.keyframes.compliant) {
    const deviation = Math.abs(
      (results.keyframes.interval - results.keyframes.expectedInterval) /
        results.keyframes.expectedInterval *
        100
    );
    if (deviation > 10) {
      guidance.push({
        message: `Keyframe interval is ${results.keyframes.interval}ms (expected ${results.keyframes.expectedInterval}ms). Verify your encoder's keyframe settings.`,
        severity: "error",
      });
    }
  } else {
    guidance.push({
      message: `Keyframe interval is correct. ✓`,
      severity: "info",
    });
  }

  // Network quality guidance
  if (results.networkQuality.latency > 150) {
    guidance.push({
      message: `High latency detected (${results.networkQuality.latency}ms). Consider using a wired connection.`,
      severity: "error",
    });
  } else if (results.networkQuality.latency > 50) {
    guidance.push({
      message: `Elevated latency (${results.networkQuality.latency}ms). A wired connection may help.`,
      severity: "warning",
    });
  }

  if (results.networkQuality.jitter > 20) {
    guidance.push({
      message: `Network jitter is high (${results.networkQuality.jitter}ms). Your connection may be unstable.`,
      severity: "warning",
    });
  }

  if (results.networkQuality.packetLoss > 1) {
    guidance.push({
      message: `Packet loss detected (${results.networkQuality.packetLoss.toFixed(2)}%). Your connection is unreliable; try a wired connection.`,
      severity: "error",
    });
  }

  // Overall health summary
  let summary = "";
  if (results.health.status === "good") {
    summary = "Your stream is healthy and ready to go live! 🚀";
  } else if (results.health.status === "marginal") {
    summary = "Your stream setup is marginal. Review the warnings above before going live.";
  } else {
    summary = "Your stream setup has issues. Review the errors above before going live.";
  }

  // Add confidence note if low
  if (results.health.confidence < 0.7) {
    summary += ` (Low confidence: ${Math.round(results.health.confidence * 100)}%)`;
  }

  return { guidance, summary };
}
