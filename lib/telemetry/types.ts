/**
 * Playback telemetry event types
 */

export interface PlaybackTelemetryEvent {
  id: string;
  timestamp: number;
  streamId: string;
  viewerId: string;
  sessionId: string;
  eventType: PlaybackEventType;
  data: Record<string, any>;
}

export type PlaybackEventType =
  | "startup"
  | "rebuffer"
  | "quality_change"
  | "error"
  | "session_end";

export interface StartupEvent {
  type: "startup";
  startupTimeMs: number;
  timestamp: number;
}

export interface RebufferEvent {
  type: "rebuffer";
  durationMs: number;
  timestamp: number;
  position: number;
}

export interface QualityChangeEvent {
  type: "quality_change";
  from: string;
  to: string;
  timestamp: number;
  reason: "auto" | "manual";
}

export interface ErrorEvent {
  type: "error";
  errorCode: string;
  errorMessage: string;
  timestamp: number;
  fatal?: boolean;
}

export interface SessionEndEvent {
  type: "session_end";
  durationSeconds: number;
  totalRebuffers: number;
  totalRebufferDurationMs: number;
  timestamp: number;
}

export interface TelemetryBatch {
  viewerId: string;
  sessionId: string;
  streamId: string;
  events: PlaybackTelemetryEvent[];
  sentAt: number;
}

export interface StreamHealthMetrics {
  streamId: string;
  timeWindow: "1h" | "24h" | "7d";
  startTime: string;
  endTime: string;
  metrics: {
    totalSessions: number;
    avgStartupTimeMs: number;
    p50StartupTimeMs: number;
    p95StartupTimeMs: number;
    rebufferRatio: number;
    avgRebufferDurationMs: number;
    errorRate: number;
    totalRebufferEvents: number;
  };
}
