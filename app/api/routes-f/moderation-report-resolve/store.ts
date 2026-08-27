import type { ReportOutcome, ResolvableReport } from "./types";
import { reportStore } from "./seedData";

export class ReportNotFoundError extends Error {}
export class ReportAlreadyResolvedError extends Error {}

export function resolveReport(
  reportId: string,
  outcome: ReportOutcome,
  now: number = Date.now()
): ResolvableReport {
  const report = reportStore.get(reportId);
  if (!report) {
    throw new ReportNotFoundError(`report '${reportId}' not found`);
  }
  if (report.status !== "open") {
    throw new ReportAlreadyResolvedError(
      `report '${reportId}' has already been resolved`
    );
  }

  const updated: ResolvableReport = {
    ...report,
    status: "resolved",
    outcome,
    resolved_at: new Date(now).toISOString(),
  };
  reportStore.set(reportId, updated);

  return updated;
}
