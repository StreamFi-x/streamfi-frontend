export type PriorityLevel = 'low' | 'med' | 'high' | 'critical';

export interface ReporterTrustScore {
  reporterId: string;
  trustScore: number; // 0-100
}

export interface ReportTriageRequest {
  report: {
    reporterId: string;
    reason: string; // e.g., "spam", "harassment", "hate_speech", "explicit_content"
  };
}

export interface ReportTriageResponse {
  priority: PriorityLevel;
  score: number;
}

export type ReasonSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ReasonSeverityMap {
  [reason: string]: ReasonSeverity;
}
