/**
 * Analyzes collected metrics and produces health scores
 */

import {
  BitrateMetrics,
  FrameMetrics,
  KeyframeMetrics,
  NetworkQualityMetrics,
  DiagnosticHealthResult,
  EncoderSettings,
} from "./types";

// Conservative thresholds - err on the side of warning
const THRESHOLDS = {
  bitrate: {
    excellentVariance: 5, // < 5%
    goodVariance: 15, // 5-15%
    marginalVariance: 30, // 15-30%
    // > 30% is poor
  },
  frames: {
    excellentDropRate: 0.1, // < 0.1%
    goodDropRate: 1, // 0.1-1%
    marginalDropRate: 5, // 1-5%
    // > 5% is poor
  },
  keyframe: {
    excellentDeviation: 0, // 0% off
    goodDeviation: 5, // ±5%
    marginalDeviation: 10, // ±10%
    // > 10% is poor
  },
  network: {
    excellentLatency: 10, // < 10ms
    goodLatency: 50, // 10-50ms
    marginalLatency: 150, // 50-150ms
    // > 150ms is poor
  },
};

export function analyzeMetrics(
  targetBitrate: number,
  actualBitrate: number,
  totalFrames: number,
  droppedFrames: number,
  keyframeIntervalMs: number,
  actualKeyframeIntervalMs: number,
  latencyMs: number,
  jitterMs: number,
  packetLossPercent: number
): {
  bitrate: BitrateMetrics;
  frames: FrameMetrics;
  keyframes: KeyframeMetrics;
  networkQuality: NetworkQualityMetrics;
  health: DiagnosticHealthResult;
} {
  // Bitrate analysis
  const bitrateVariance =
    targetBitrate > 0 ? Math.abs(actualBitrate - targetBitrate) / targetBitrate * 100 : 0;
  let bitrateStability: BitrateMetrics["stability"];
  if (bitrateVariance < THRESHOLDS.bitrate.excellentVariance) {
    bitrateStability = "excellent";
  } else if (bitrateVariance < THRESHOLDS.bitrate.goodVariance) {
    bitrateStability = "good";
  } else if (bitrateVariance < THRESHOLDS.bitrate.marginalVariance) {
    bitrateStability = "marginal";
  } else {
    bitrateStability = "poor";
  }

  const bitrate: BitrateMetrics = {
    target: targetBitrate,
    actual: actualBitrate,
    variance: Math.round(bitrateVariance * 100) / 100,
    stability: bitrateStability,
  };

  // Frame analysis
  const dropRate = totalFrames > 0 ? (droppedFrames / totalFrames) * 100 : 0;
  const frames: FrameMetrics = {
    total: totalFrames,
    dropped: droppedFrames,
    dropRate: Math.round(dropRate * 100) / 100,
  };

  // Keyframe analysis
  const expectedInterval = keyframeIntervalMs;
  const intervalDeviation =
    expectedInterval > 0
      ? Math.abs(actualKeyframeIntervalMs - expectedInterval) / expectedInterval * 100
      : 0;
  const keyframeCompliant = intervalDeviation <= THRESHOLDS.keyframe.marginalDeviation;

  const keyframes: KeyframeMetrics = {
    interval: actualKeyframeIntervalMs,
    expectedInterval,
    compliant: keyframeCompliant,
  };

  // Network quality analysis
  const networkQuality: NetworkQualityMetrics = {
    latency: latencyMs,
    jitter: jitterMs,
    packetLoss: packetLossPercent,
  };

  // Overall health score based on weighted metrics
  const healthScore = computeHealthScore(
    bitrateStability,
    dropRate,
    intervalDeviation,
    latencyMs,
    jitterMs,
    packetLossPercent
  );

  const health: DiagnosticHealthResult = {
    status: healthScore.status,
    confidence: healthScore.confidence,
  };

  return { bitrate, frames, keyframes, networkQuality, health };
}

function computeHealthScore(
  bitrateStability: string,
  dropRate: number,
  keyframeDeviation: number,
  latencyMs: number,
  jitterMs: number,
  packetLossPercent: number
): { status: "good" | "marginal" | "poor"; confidence: number } {
  let score = 100;
  let confidence = 1;

  // Bitrate stability (40% weight)
  switch (bitrateStability) {
    case "excellent":
      break;
    case "good":
      score -= 5;
      break;
    case "marginal":
      score -= 15;
      confidence = 0.8;
      break;
    case "poor":
      score -= 40;
      confidence = 0.6;
      break;
  }

  // Frame drop rate (30% weight)
  if (dropRate > THRESHOLDS.frames.marginalDropRate) {
    score -= 30;
    confidence *= 0.9;
  } else if (dropRate > THRESHOLDS.frames.goodDropRate) {
    score -= 15;
    confidence *= 0.95;
  } else if (dropRate > THRESHOLDS.frames.excellentDropRate) {
    score -= 3;
  }

  // Keyframe compliance (15% weight)
  if (keyframeDeviation > THRESHOLDS.keyframe.marginalDeviation) {
    score -= 15;
  } else if (keyframeDeviation > THRESHOLDS.keyframe.goodDeviation) {
    score -= 5;
  }

  // Network conditions (15% weight)
  if (latencyMs > THRESHOLDS.network.marginalLatency || jitterMs > 50 || packetLossPercent > 1) {
    score -= 15;
    confidence *= 0.85;
  } else if (latencyMs > THRESHOLDS.network.goodLatency || jitterMs > 20) {
    score -= 5;
    confidence *= 0.95;
  }

  let status: "good" | "marginal" | "poor";
  if (score >= 75) {
    status = "good";
  } else if (score >= 50) {
    status = "marginal";
  } else {
    status = "poor";
  }

  return { status, confidence: Math.max(0.3, confidence) };
}
