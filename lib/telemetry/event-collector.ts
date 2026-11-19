/**
 * Client-side playback event collector for telemetry
 * Hooks into MuxPlayer lifecycle to capture RUM signals
 */

import { PlaybackTelemetryEvent, PlaybackEventType } from "./types";

export class PlaybackEventCollector {
  private events: PlaybackTelemetryEvent[] = [];
  private sessionId: string;
  private viewerId: string;
  private streamId: string;
  private startTime: number = 0;
  private firstFrameTime: number = 0;
  private rebufferStartTime: number | null = null;
  private totalRebufferDuration: number = 0;
  private rebufferCount: number = 0;

  constructor(streamId: string, viewerId: string, sessionId: string) {
    this.streamId = streamId;
    this.viewerId = viewerId;
    this.sessionId = sessionId;
    this.startTime = Date.now();
  }

  /**
   * Record player mount start
   */
  recordPlayerMount() {
    this.startTime = Date.now();
  }

  /**
   * Record first frame rendered (startup time)
   */
  recordFirstFrame() {
    if (this.firstFrameTime) return; // Only record once

    this.firstFrameTime = Date.now();
    const startupTimeMs = this.firstFrameTime - this.startTime;

    const event: PlaybackTelemetryEvent = {
      id: this.generateEventId(),
      timestamp: this.firstFrameTime,
      streamId: this.streamId,
      viewerId: this.viewerId,
      sessionId: this.sessionId,
      eventType: "startup",
      data: {
        startupTimeMs,
      },
    };

    this.events.push(event);
  }

  /**
   * Record rebuffer start
   */
  recordRebufferStart() {
    this.rebufferStartTime = Date.now();
  }

  /**
   * Record rebuffer end
   */
  recordRebufferEnd() {
    if (this.rebufferStartTime === null) return;

    const endTime = Date.now();
    const durationMs = endTime - this.rebufferStartTime;
    this.totalRebufferDuration += durationMs;
    this.rebufferCount += 1;

    const event: PlaybackTelemetryEvent = {
      id: this.generateEventId(),
      timestamp: endTime,
      streamId: this.streamId,
      viewerId: this.viewerId,
      sessionId: this.sessionId,
      eventType: "rebuffer",
      data: {
        durationMs,
        position: this.getCurrentPlaybackPosition(),
      },
    };

    this.events.push(event);
    this.rebufferStartTime = null;
  }

  /**
   * Record quality/bitrate change
   */
  recordQualityChange(from: string, to: string, reason: "auto" | "manual" = "auto") {
    const event: PlaybackTelemetryEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      streamId: this.streamId,
      viewerId: this.viewerId,
      sessionId: this.sessionId,
      eventType: "quality_change",
      data: {
        from,
        to,
        reason,
      },
    };

    this.events.push(event);
  }

  /**
   * Record playback error
   */
  recordError(errorCode: string, errorMessage: string, fatal: boolean = false) {
    const event: PlaybackTelemetryEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      streamId: this.streamId,
      viewerId: this.viewerId,
      sessionId: this.sessionId,
      eventType: "error",
      data: {
        errorCode,
        errorMessage,
        fatal,
      },
    };

    this.events.push(event);
  }

  /**
   * Record session end and get all metrics
   */
  recordSessionEnd(): PlaybackTelemetryEvent {
    const now = Date.now();
    const durationSeconds = Math.floor((now - this.startTime) / 1000);

    const event: PlaybackTelemetryEvent = {
      id: this.generateEventId(),
      timestamp: now,
      streamId: this.streamId,
      viewerId: this.viewerId,
      sessionId: this.sessionId,
      eventType: "session_end",
      data: {
        durationSeconds,
        totalRebuffers: this.rebufferCount,
        totalRebufferDurationMs: this.totalRebufferDuration,
      },
    };

    this.events.push(event);
    return event;
  }

  /**
   * Get all collected events
   */
  getEvents(): PlaybackTelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Clear events after sending
   */
  clearEvents() {
    this.events = [];
  }

  /**
   * Get session metrics
   */
  getSessionMetrics() {
    return {
      sessionId: this.sessionId,
      streamId: this.streamId,
      viewerId: this.viewerId,
      startupTimeMs: this.firstFrameTime ? this.firstFrameTime - this.startTime : null,
      rebufferCount: this.rebufferCount,
      totalRebufferDurationMs: this.totalRebufferDuration,
      rebufferRatio: this.totalRebufferDuration / (Date.now() - this.startTime),
      eventCount: this.events.length,
    };
  }

  private getCurrentPlaybackPosition(): number {
    // In a real implementation, this would query the player's current time
    // For now return a placeholder that can be enhanced
    return 0;
  }

  private generateEventId(): string {
    return `${this.sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
