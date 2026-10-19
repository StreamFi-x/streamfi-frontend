/**
 * Main diagnostic service orchestrating pre-flight checks
 */

import { EncoderSettings, DiagnosticResults } from "./types";
import {
  sendTestFrames,
  collectMuxMetrics,
  deleteMuxStream,
  TestStreamMetrics,
} from "./mux-ingest-simulator";
import { analyzeMetrics } from "./metrics-analyzer";
import { createMuxStream } from "@/lib/mux/server";
import { logger } from "@/lib/tracing/logger";

const DIAGNOSTIC_DURATION_MS = 12000; // 12 seconds of test streaming
const FRAME_DROP_RATE_SIMULATION = 0.005; // 0.5% simulated drop rate under stress

/**
 * Runs end-to-end diagnostics on a stream
 */
export async function runDiagnostics(
  encoderSettings: EncoderSettings,
  userId?: string
): Promise<DiagnosticResults> {
  let testStreamId: string | null = null;

  try {
    logger.info("Starting diagnostics", {
      userId,
      bitrate: encoderSettings.bitrate,
      resolution: encoderSettings.resolution,
    });

    // Create a temporary test stream
    const streamData = await createMuxStream({
      name: `[DIAGNOSTIC] User ${userId || "unknown"}`,
      record: false,
      latencyMode: "low",
    });

    testStreamId = streamData.id;
    logger.info("Created test stream", { testStreamId });

    // Send test frames at target bitrate for diagnostic duration
    const testMetrics = await sendTestFrames(testStreamId, encoderSettings, DIAGNOSTIC_DURATION_MS);

    logger.info("Test frames sent", {
      testStreamId,
      totalFrames: testMetrics.totalFrames,
      averageBitrate: testMetrics.averageBitrate,
    });

    // Collect metrics from Mux about the stream
    const muxMetrics = await collectMuxMetrics(testStreamId, DIAGNOSTIC_DURATION_MS);

    logger.info("Collected Mux metrics", { testStreamId, muxMetrics });

    // Compute actual bitrate from collected data
    const actualBitrate = muxMetrics.averageBitrate || testMetrics.averageBitrate;

    // Analyze metrics to produce diagnostics
    const diagnosticResults = analyzeMetrics(
      encoderSettings.bitrate, // target bitrate
      actualBitrate, // actual bitrate
      testMetrics.totalFrames,
      testMetrics.droppedFrames,
      encoderSettings.keyframeIntervalMs,
      testMetrics.keyframeInterval,
      25, // simulated latency (ms)
      5, // simulated jitter (ms)
      0 // simulated packet loss (%)
    );

    const results: DiagnosticResults = {
      bitrate: diagnosticResults.bitrate,
      frames: diagnosticResults.frames,
      keyframes: diagnosticResults.keyframes,
      networkQuality: diagnosticResults.networkQuality,
      health: diagnosticResults.health,
      timestamp: new Date().toISOString(),
    };

    logger.info("Diagnostics complete", {
      testStreamId,
      health: results.health.status,
      confidence: results.health.confidence,
    });

    return results;
  } catch (error) {
    logger.error("Diagnostics failed", {
      userId,
      testStreamId,
      error: String(error),
    });

    // Return partial results with low confidence if diagnostics service fails
    return getServiceUnavailableResults();
  } finally {
    // Clean up test stream
    if (testStreamId) {
      await deleteMuxStream(testStreamId);
    }
  }
}

/**
 * Returns fallback results when diagnostic service is unavailable
 */
function getServiceUnavailableResults(): DiagnosticResults {
  return {
    bitrate: {
      target: 0,
      actual: 0,
      variance: 0,
      stability: "poor",
    },
    frames: {
      total: 0,
      dropped: 0,
      dropRate: 0,
    },
    keyframes: {
      interval: 0,
      expectedInterval: 0,
      compliant: false,
    },
    networkQuality: {
      latency: 0,
      jitter: 0,
      packetLoss: 0,
    },
    health: {
      status: "poor",
      confidence: 0.1,
    },
    timestamp: new Date().toISOString(),
  };
}
