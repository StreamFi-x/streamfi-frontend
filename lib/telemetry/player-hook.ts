/**
 * React hook for instrumenting MuxPlayer with telemetry
 */

import { useEffect, useRef } from "react";
import { PlaybackEventCollector } from "./event-collector";
import { getBatchService } from "./batch-service";

export interface UsePlaybackTelemetryOptions {
  streamId: string;
  viewerId: string;
  sessionId: string;
  enableLogging?: boolean;
}

export function usePlaybackTelemetry(options: UsePlaybackTelemetryOptions) {
  const collectorRef = useRef<PlaybackEventCollector | null>(null);
  const batchServiceRef = useRef(getBatchService());
  const playerRef = useRef<HTMLElement | null>(null);
  const isRebufferingRef = useRef(false);
  const { streamId, viewerId, sessionId, enableLogging = false } = options;

  useEffect(() => {
    // Initialize collector
    collectorRef.current = new PlaybackEventCollector(streamId, viewerId, sessionId);
    const collector = collectorRef.current;
    const batchService = batchServiceRef.current;

    batchService.registerCollector(sessionId, collector);

    // Record mount
    collector.recordPlayerMount();

    const handleLoadedMetadata = (e: Event) => {
      if (enableLogging) console.log("[Telemetry] First frame loaded");
      collector.recordFirstFrame();

      // Send events in batch
      const events = collector.getEvents();
      if (events.length > 0) {
        batchService.addEvents(sessionId, events);
        collector.clearEvents();
      }
    };

    const handleWaiting = () => {
      if (enableLogging) console.log("[Telemetry] Rebuffer started");
      isRebufferingRef.current = true;
      collector.recordRebufferStart();
    };

    const handlePlaying = () => {
      if (isRebufferingRef.current) {
        if (enableLogging) console.log("[Telemetry] Rebuffer ended");
        collector.recordRebufferEnd();
        isRebufferingRef.current = false;

        // Batch events periodically
        const events = collector.getEvents();
        if (events.length > 0) {
          batchService.addEvents(sessionId, events);
          collector.clearEvents();
        }
      }
    };

    const handleError = (e: Event) => {
      const errorEvent = e as ErrorEvent;
      if (enableLogging) console.log("[Telemetry] Playback error", errorEvent);

      const message = errorEvent.message || "Unknown error";
      const code = (errorEvent as any).code || "UNKNOWN";
      collector.recordError(code, message, true);

      const events = collector.getEvents();
      if (events.length > 0) {
        batchService.addEvents(sessionId, events);
        collector.clearEvents();
      }
    };

    const handleRateChange = (e: Event) => {
      // Quality/bitrate changes may be indicated here
      if (enableLogging) console.log("[Telemetry] Rate changed", e);
    };

    // Try to find the mux-player element or parent audio/video element
    const findPlayerElement = () => {
      // Look for mux-player element
      let element = document.querySelector("mux-player");
      if (!element) {
        // Fallback: look for video element
        element = document.querySelector("video");
      }
      return element as HTMLElement | null;
    };

    // Attach listeners with retry logic
    const attachListenersWithRetry = (attempt = 0) => {
      const element = findPlayerElement();
      if (!element && attempt < 10) {
        // Retry for up to 5 seconds
        setTimeout(() => attachListenersWithRetry(attempt + 1), 500);
        return;
      }

      if (!element) {
        console.warn("[Telemetry] Could not find player element after retries");
        return;
      }

      playerRef.current = element;

      element.addEventListener("loadedmetadata", handleLoadedMetadata);
      element.addEventListener("waiting", handleWaiting);
      element.addEventListener("playing", handlePlaying);
      element.addEventListener("error", handleError);
      element.addEventListener("ratechange", handleRateChange);

      if (enableLogging) console.log("[Telemetry] Listeners attached to player");
    };

    attachListenersWithRetry();

    // Cleanup on unmount
    return () => {
      const element = playerRef.current;
      if (element) {
        element.removeEventListener("loadedmetadata", handleLoadedMetadata);
        element.removeEventListener("waiting", handleWaiting);
        element.removeEventListener("playing", handlePlaying);
        element.removeEventListener("error", handleError);
        element.removeEventListener("ratechange", handleRateChange);
      }

      // Record session end and flush
      if (collector) {
        collector.recordSessionEnd();
        const events = collector.getEvents();
        if (events.length > 0) {
          batchService.addEvents(sessionId, events);
          batchService.flushOnUnload(sessionId);
        }
      }
    };
  }, [streamId, viewerId, sessionId, enableLogging]);

  return {
    getSessionMetrics: () => collectorRef.current?.getSessionMetrics(),
  };
}
