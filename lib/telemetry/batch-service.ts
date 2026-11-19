/**
 * Client-side batching service for telemetry events
 * Implements bounded batching with configurable thresholds
 */

import { PlaybackTelemetryEvent, TelemetryBatch } from "./types";
import { PlaybackEventCollector } from "./event-collector";

export interface BatchServiceConfig {
  maxEvents: number;
  flushIntervalMs: number;
  endpoint: string;
}

const DEFAULT_CONFIG: BatchServiceConfig = {
  maxEvents: 50,
  flushIntervalMs: 10000, // 10 seconds
  endpoint: "/api/telemetry/events",
};

export class TelemetryBatchService {
  private collectors: Map<string, PlaybackEventCollector> = new Map();
  private config: BatchServiceConfig;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents: PlaybackTelemetryEvent[] = [];
  private isOnline: boolean = navigator.onLine;

  constructor(config: Partial<BatchServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupNetworkListeners();
  }

  /**
   * Register a collector for a stream session
   */
  registerCollector(sessionId: string, collector: PlaybackEventCollector) {
    this.collectors.set(sessionId, collector);
  }

  /**
   * Add events from a collector to pending batch
   */
  addEvents(sessionId: string, events: PlaybackTelemetryEvent[]) {
    this.pendingEvents.push(...events);

    // Flush if batch size threshold reached
    if (this.pendingEvents.length >= this.config.maxEvents) {
      this.flush();
    } else if (!this.flushTimer) {
      // Schedule a flush if not already scheduled
      this.scheduleFlushedh();
    }
  }

  /**
   * Flush pending events to server
   */
  async flush(): Promise<void> {
    if (this.pendingEvents.length === 0 || !this.isOnline) {
      return;
    }

    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const eventsBatch = this.pendingEvents.splice(0, this.config.maxEvents);
    const batch: TelemetryBatch = {
      viewerId: eventsBatch[0]?.viewerId || "unknown",
      sessionId: eventsBatch[0]?.sessionId || "unknown",
      streamId: eventsBatch[0]?.streamId || "unknown",
      events: eventsBatch,
      sentAt: Date.now(),
    };

    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
        // Don't block page unload
        keepalive: true,
      });

      if (!response.ok) {
        console.warn(`[Telemetry] Failed to send batch: ${response.status}`);
        // Re-add events for retry (with limit to prevent unbounded growth)
        if (this.pendingEvents.length < 1000) {
          this.pendingEvents.unshift(...eventsBatch);
        }
      } else {
        console.debug("[Telemetry] Batch sent successfully", {
          eventCount: eventsBatch.length,
        });
      }
    } catch (error) {
      console.warn("[Telemetry] Failed to send batch:", error);
      // Re-add events for retry
      if (this.pendingEvents.length < 1000) {
        this.pendingEvents.unshift(...eventsBatch);
      }
    }

    // Schedule next flush if there are pending events
    if (this.pendingEvents.length > 0) {
      this.scheduleFlushedh();
    }
  }

  /**
   * Flush on page unload/navigate
   */
  flushOnUnload(sessionId: string) {
    const collector = this.collectors.get(sessionId);
    if (collector) {
      const events = collector.getEvents();
      if (events.length > 0) {
        this.addEvents(sessionId, events);
        // Use sendBeacon for unload to ensure delivery
        this.sendBeacon();
      }
      this.collectors.delete(sessionId);
    }
  }

  /**
   * Send beacon for unload scenarios
   */
  private sendBeacon() {
    if (this.pendingEvents.length === 0) return;

    const batch: TelemetryBatch = {
      viewerId: this.pendingEvents[0]?.viewerId || "unknown",
      sessionId: this.pendingEvents[0]?.sessionId || "unknown",
      streamId: this.pendingEvents[0]?.streamId || "unknown",
      events: this.pendingEvents,
      sentAt: Date.now(),
    };

    try {
      navigator.sendBeacon(
        this.config.endpoint,
        JSON.stringify(batch)
      );
      this.pendingEvents = [];
    } catch (error) {
      console.warn("[Telemetry] sendBeacon failed:", error);
    }
  }

  private scheduleFlushedh() {
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  private setupNetworkListeners() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.flush();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });

    // Flush on page unload
    window.addEventListener("beforeunload", () => {
      this.sendBeacon();
    });
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.collectors.clear();
    this.pendingEvents = [];
  }
}

// Singleton instance
let batchService: TelemetryBatchService | null = null;

export function getBatchService(config?: Partial<BatchServiceConfig>): TelemetryBatchService {
  if (!batchService) {
    batchService = new TelemetryBatchService(config);
  }
  return batchService;
}
