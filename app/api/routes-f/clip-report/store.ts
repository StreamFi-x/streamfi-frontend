import type { ClipReport, ClipReportReason } from "./types";
import { clipReportStore, reporterActivity } from "./seedData";

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_REPORTS = 5;

let nextReportSeq = 1;

export class RateLimitExceededError extends Error {}

function isRateLimited(reporterId: string, now: number): boolean {
  const timestamps = reporterActivity.get(reporterId) ?? [];
  const withinWindow = timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  reporterActivity.set(reporterId, withinWindow);
  return withinWindow.length >= RATE_LIMIT_MAX_REPORTS;
}

function recordActivity(reporterId: string, now: number): void {
  const timestamps = reporterActivity.get(reporterId) ?? [];
  timestamps.push(now);
  reporterActivity.set(reporterId, timestamps);
}

export function submitClipReport(input: {
  clip_id: string;
  reporter_id: string;
  reason: ClipReportReason;
  description?: string;
}): ClipReport {
  const now = Date.now();

  if (isRateLimited(input.reporter_id, now)) {
    throw new RateLimitExceededError(
      `reporter '${input.reporter_id}' has exceeded the report rate limit`
    );
  }

  recordActivity(input.reporter_id, now);

  const report: ClipReport = {
    report_id: `report_${nextReportSeq++}_${now}`,
    clip_id: input.clip_id,
    reporter_id: input.reporter_id,
    reason: input.reason,
    description: input.description,
    status: "active",
    created_at: new Date(now).toISOString(),
  };

  clipReportStore.set(report.report_id, report);
  return report;
}

export function countActiveReports(clipId: string): number {
  let count = 0;
  for (const report of clipReportStore.values()) {
    if (report.clip_id === clipId && report.status === "active") {
      count += 1;
    }
  }
  return count;
}
