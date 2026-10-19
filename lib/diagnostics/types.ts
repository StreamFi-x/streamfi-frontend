/**
 * Shared TypeScript interfaces for diagnostic system
 */

export interface EncoderSettings {
  bitrate: number; // in kbps
  resolution: string; // e.g., "1920x1080"
  keyframeIntervalMs: number; // milliseconds between keyframes
}

export interface BitrateMetrics {
  target: number; // target bitrate in kbps
  actual: number; // actual average bitrate in kbps
  variance: number; // percentage variance from target (0-100)
  stability: "excellent" | "good" | "marginal" | "poor";
}

export interface FrameMetrics {
  total: number;
  dropped: number;
  dropRate: number; // percentage (0-100)
}

export interface KeyframeMetrics {
  interval: number; // actual interval in ms
  expectedInterval: number; // expected interval in ms
  compliant: boolean;
}

export interface NetworkQualityMetrics {
  latency: number; // milliseconds
  jitter: number; // milliseconds
  packetLoss: number; // percentage (0-100)
}

export interface DiagnosticHealthResult {
  status: "good" | "marginal" | "poor";
  confidence: number; // 0-1, how confident we are in this result
}

export interface DiagnosticResults {
  bitrate: BitrateMetrics;
  frames: FrameMetrics;
  keyframes: KeyframeMetrics;
  networkQuality: NetworkQualityMetrics;
  health: DiagnosticHealthResult;
  timestamp: string;
}

export interface GuidanceItem {
  message: string;
  severity: "info" | "warning" | "error";
}

export interface DiagnosticResponse {
  success: boolean;
  results: DiagnosticResults | null;
  guidance: GuidanceItem[];
  summary: string;
  timestamp: string;
}
