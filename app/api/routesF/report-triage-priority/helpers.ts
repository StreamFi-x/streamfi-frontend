import { PriorityLevel, ReasonSeverity, ReasonSeverityMap, ReporterTrustScore } from './types';

// Bundle reporter trust scores
const REPORTER_TRUST_SCORES: Map<string, number> = new Map([
  ['verified_mod', 95],
  ['trusted_user', 75],
  ['regular_viewer', 50],
  ['new_user', 20],
  ['anonymous', 10],
]);

// Reason to severity mapping
const REASON_SEVERITY_MAP: ReasonSeverityMap = {
  spam: 'low',
  off_topic: 'low',
  misinformation: 'medium',
  harassment: 'high',
  hate_speech: 'critical',
  explicit_content: 'high',
  threats: 'critical',
  illegal_content: 'critical',
  sexual_abuse: 'critical',
  violence: 'critical',
};

// Default severity for unknown reasons
const DEFAULT_REASON_SEVERITY: ReasonSeverity = 'medium';

export function getReporterTrustScore(reporterId: string): ReporterTrustScore {
  const score = REPORTER_TRUST_SCORES.get(reporterId) ?? 30; // default: slightly skeptical
  return { reporterId, trustScore: score };
}

export function getReasonSeverity(reason: string): ReasonSeverity {
  const normalized = reason.toLowerCase().replace(/\s+/g, '_');
  return REASON_SEVERITY_MAP[normalized] ?? DEFAULT_REASON_SEVERITY;
}

function reasonSeverityToScore(severity: ReasonSeverity): number {
  switch (severity) {
    case 'low':
      return 25;
    case 'medium':
      return 50;
    case 'high':
      return 75;
    case 'critical':
      return 100;
  }
}

export function calculatePriorityScore(trustScore: number, reasonSeverity: ReasonSeverity): number {
  // Weight: 40% trust, 60% reason severity
  const trustWeight = trustScore * 0.4;
  const severityWeight = reasonSeverityToScore(reasonSeverity) * 0.6;
  return Math.round(trustWeight + severityWeight);
}

export function scoreToPriority(score: number): PriorityLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'med';
  return 'low';
}
