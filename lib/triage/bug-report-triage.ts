export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface BugReportInput {
  id: string;
  title: string;
  description: string;
  route: string;
  errorMessage?: string;
  reportedAt: number;
}

export interface BugTriageResult {
  id: string;
  severity: BugSeverity;
  slaTargetHours: number;
  slaBreached: boolean;
  duplicateCandidates: Array<{ reportId: string; similarityScore: number }>;
  routedToTeam: string;
}

const SLA_HOURS: Record<BugSeverity, number> = {
  critical: 2,
  high: 8,
  medium: 24,
  low: 72,
};

/**
 * Classifies bug report severity using guided heuristics and route context.
 */
export function classifySeverity(report: BugReportInput): BugSeverity {
  const text = `${report.title} ${report.description} ${report.errorMessage ?? ''}`.toLowerCase();

  if (
    text.includes('wallet') ||
    text.includes('tip failed') ||
    text.includes('broadcast down') ||
    text.includes('exploit') ||
    text.includes('funds') ||
    report.route.startsWith('/api/wallet')
  ) {
    return 'critical';
  }

  if (
    text.includes('cannot stream') ||
    text.includes('login broken') ||
    text.includes('chat disconnected') ||
    report.errorMessage?.includes('500')
  ) {
    return 'high';
  }

  if (text.includes('slow') || text.includes('lag') || text.includes('layout')) {
    return 'medium';
  }

  return 'low';
}

/**
 * Computes text and metadata similarity to identify duplicate bug reports.
 */
export function findDuplicateCandidates(
  newReport: BugReportInput,
  existingReports: BugReportInput[]
): Array<{ reportId: string; similarityScore: number }> {
  const newTokens = new Set(
    `${newReport.title} ${newReport.route}`.toLowerCase().split(/\W+/).filter(Boolean)
  );

  const candidates: Array<{ reportId: string; similarityScore: number }> = [];

  for (const existing of existingReports) {
    if (existing.id === newReport.id) continue;

    const existingTokens = new Set(
      `${existing.title} ${existing.route}`.toLowerCase().split(/\W+/).filter(Boolean)
    );

    let intersectionCount = 0;
    for (const token of newTokens) {
      if (existingTokens.has(token)) intersectionCount++;
    }

    const unionSize = new Set([...newTokens, ...existingTokens]).size;
    const jaccard = unionSize > 0 ? intersectionCount / unionSize : 0;

    if (jaccard >= 0.4 || (newReport.errorMessage && newReport.errorMessage === existing.errorMessage)) {
      candidates.push({
        reportId: existing.id,
        similarityScore: Math.round((newReport.errorMessage === existing.errorMessage ? 0.95 : jaccard) * 100) / 100,
      });
    }
  }

  return candidates.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Evaluates SLA tracking and routes report to on-call or triage queue.
 */
export function triageBugReport(
  report: BugReportInput,
  existingReports: BugReportInput[] = []
): BugTriageResult {
  const severity = classifySeverity(report);
  const slaTargetHours = SLA_HOURS[severity];
  const ageHours = (Date.now() - report.reportedAt) / (1000 * 60 * 60);

  const duplicateCandidates = findDuplicateCandidates(report, existingReports);

  const routedToTeam =
    severity === 'critical'
      ? 'on-call-security-payments'
      : severity === 'high'
      ? 'core-streaming-team'
      : 'general-triage-queue';

  return {
    id: report.id,
    severity,
    slaTargetHours,
    slaBreached: ageHours > slaTargetHours,
    duplicateCandidates,
    routedToTeam,
  };
}
