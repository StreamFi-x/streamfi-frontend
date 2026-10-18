/**
 * Simulates test ingest to Mux for diagnostics
 */

import { EncoderSettings, DiagnosticResults } from "./types";
import { createMuxStream } from "@/lib/mux/server";
import Mux from "@mux/mux-node";
import { logger } from "@/lib/tracing/logger";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
  maxRetries: 0,
});

export interface TestStreamMetrics {
  totalBytes: number;
  totalFrames: number;
  droppedFrames: number;
  averageBitrate: number;
  testDurationMs: number;
  keyframeInterval: number;
}

/**
 * Simulates frame generation and bitrate pacing
 */
export async function sendTestFrames(
  streamId: string,
  encoderSettings: EncoderSettings,
  durationMs: number
): Promise<TestStreamMetrics> {
  const targetBitrate = encoderSettings.bitrate * 1000; // Convert kbps to bps
  const resolution = parseResolution(encoderSettings.resolution);
  const keyframeIntervalMs = encoderSettings.keyframeIntervalMs;

  const startTime = Date.now();
  let totalBytes = 0;
  let totalFrames = 0;
  let droppedFrames = 0;
  let bytesPerSecond = targetBitrate / 8;
  let keyframesSent = 0;

  // Simulate sending frames at the target bitrate
  // In production, this would pump synthetic video frames to the Mux ingest point
  // For now, we simulate collection of metrics based on target settings
  const frameInterval = 33.33; // ~30 fps
  const bytesPerFrame = bytesPerSecond / (1000 / frameInterval);

  while (Date.now() - startTime < durationMs) {
    // Simulate frame transmission
    totalFrames++;

    // Insert keyframe at specified interval
    const isKeyframe = totalFrames % Math.ceil(keyframeIntervalMs / frameInterval) === 0;

    // Calculate frame size (keyframes are larger, typically 2-3x)
    const frameSizeMultiplier = isKeyframe ? 2.5 : 1;
    const frameBytes = Math.round(bytesPerFrame * frameSizeMultiplier);

    totalBytes += frameBytes;

    // Simulate occasional frame drops (0-1% under normal conditions)
    if (Math.random() < 0.001) {
      droppedFrames++;
    }

    if (isKeyframe) {
      keyframesSent++;
    }

    // Sleep for ~frame interval (non-blocking simulation)
    await new Promise(resolve => setTimeout(resolve, frameInterval));
  }

  const testDurationMs = Date.now() - startTime;
  const averageBitrate = Math.round((totalBytes * 8) / (testDurationMs / 1000) / 1000); // Convert to kbps

  return {
    totalBytes,
    totalFrames,
    droppedFrames,
    averageBitrate,
    testDurationMs,
    keyframeInterval: keyframeIntervalMs,
  };
}

/**
 * Collects live stream metrics from Mux
 */
export async function collectMuxMetrics(
  streamId: string,
  durationMs: number
): Promise<Partial<TestStreamMetrics>> {
  try {
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds
    const maxAttempts = Math.ceil(durationMs / pollInterval) + 5; // Allow some buffer
    let attempts = 0;

    const metrics: Partial<TestStreamMetrics> = {
      totalBytes: 0,
      totalFrames: 0,
      droppedFrames: 0,
      averageBitrate: 0,
    };

    while (Date.now() - startTime < durationMs && attempts < maxAttempts) {
      try {
        const livestream = await mux.video.liveStreams.retrieve(streamId);

        if (livestream && livestream.status === "active") {
          // Track the stream is active
          // In production, we'd parse detailed metrics from Mux's insights API
          metrics.averageBitrate = livestream.recent_mux_insights?.bitrate_window_ms
            ? Math.round(livestream.recent_mux_insights.bitrate_window_ms)
            : 0;
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (err) {
        logger.warn("Failed to collect Mux metrics", { error: String(err) });
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    return metrics;
  } catch (err) {
    logger.error("Error collecting Mux metrics", { error: String(err) });
    throw err;
  }
}

/**
 * Parses resolution string like "1920x1080" into dimensions
 */
function parseResolution(resolutionStr: string): { width: number; height: number } {
  const [width, height] = resolutionStr.split("x").map(Number);
  return { width: width || 1920, height: height || 1080 };
}

/**
 * Deletes a temporary test stream from Mux
 */
export async function deleteMuxStream(streamId: string): Promise<void> {
  try {
    await mux.video.liveStreams.delete(streamId);
    logger.info("Deleted test stream", { streamId });
  } catch (err) {
    logger.warn("Failed to delete test stream", { streamId, error: String(err) });
    // Don't throw - this is cleanup and should be non-blocking
  }
}
