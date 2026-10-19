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
          message: "Diagnostics are temporarily unavailable. You can still go live if you choose to.",
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
      message: `Your internet connection is slower than your video bitrate setting. Your video quality will be reduced. Try lowering your bitrate to ${recommendedBitrate} kbps or switch to a wired internet connection.`,
      severity: "error",
    });
  } else if (results.bitrate.stability === "marginal") {
    const recommendedBitrate = Math.round(results.bitrate.actual * 0.85);
    guidance.push({
      message: `Your connection is a bit slow for your current bitrate. For more stable video, try lowering it to ${recommendedBitrate} kbps or use a wired connection.`,
      severity: "warning",
    });
  } else if (results.bitrate.stability === "good") {
    guidance.push({
      message: `Your bitrate is stable at ${results.bitrate.actual} kbps. ✓`,
      severity: "info",
    });
  } else if (results.bitrate.stability === "excellent") {
    guidance.push({
      message: `Your bitrate is excellent at ${results.bitrate.actual} kbps. You could increase it for better quality if desired. ✓`,
      severity: "info",
    });
  }

  // Frame drop guidance
  if (results.frames.dropRate > 5) {
    guidance.push({
      message: `Significant frame drops detected (${results.frames.dropRate.toFixed(1)}%). Your video will appear choppy. Check that your encoder is configured correctly and your connection is stable. Try a wired connection or lower your bitrate.`,
      severity: "error",
    });
  } else if (results.frames.dropRate > 1) {
    guidance.push({
      message: `Some frame drops detected (${results.frames.dropRate.toFixed(1)}%). Your video quality may be affected. Monitor your connection quality during your stream.`,
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
        message: `Your encoder's keyframe setting (${results.keyframes.interval}ms) doesn't match what you configured (${results.keyframes.expectedInterval}ms). Check your encoder settings to make sure the keyframe interval is set correctly.`,
        severity: "error",
      });
    }
  } else {
    guidance.push({
      message: `Your keyframe settings are correct. ✓`,
      severity: "info",
    });
  }

  // Network quality guidance
  if (results.networkQuality.latency > 150) {
    guidance.push({
      message: `High network latency (${results.networkQuality.latency}ms) detected. There may be delays between when you broadcast and when viewers see it. Try connecting with a wired internet connection for better performance.`,
      severity: "error",
    });
  } else if (results.networkQuality.latency > 50) {
    guidance.push({
      message: `Your network has some latency (${results.networkQuality.latency}ms). A wired connection would help reduce delays.`,
      severity: "warning",
    });
  }

  if (results.networkQuality.jitter > 20) {
    guidance.push({
      message: `Your network connection is inconsistent (high jitter: ${results.networkQuality.jitter}ms). This can cause video quality issues. Try a wired internet connection instead of WiFi.`,
      severity: "warning",
    });
  }

  if (results.networkQuality.packetLoss > 1) {
    guidance.push({
      message: `Packet loss detected (${results.networkQuality.packetLoss.toFixed(2)}%). Your internet connection is unreliable and your stream may drop. Switch to a wired internet connection.`,
      severity: "error",
    });
  }

  // Overall health summary with non-blocking reminder
  let summary = "";
  if (results.health.status === "good") {
    summary = "Your stream is healthy and ready to go live! 🚀 You can start streaming now.";
  } else if (results.health.status === "marginal") {
    summary = "Your stream setup is marginal—you may experience issues. You can still go live, but consider the warnings above first.";
  } else if (results.health.status === "poor") {
    summary = "Your stream setup has significant issues. You can still go live if you choose to, but your viewers may experience quality problems.";
  } else {
    summary = "Diagnostics are not conclusive. You can go live at your discretion.";
  }

  // Add confidence note if low
  if (results.health.confidence < 0.7) {
    summary += ` (Low confidence: ${Math.round(results.health.confidence * 100)}%)`;
  }

  return { guidance, summary };
}
