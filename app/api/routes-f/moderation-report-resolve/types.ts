export type ReportOutcome = "dismissed" | "warned" | "timeout" | "banned";

export type ResolvableReportStatus = "open" | "resolved";

export interface ResolvableReport {
  reportId: string;
  creator_id: string;
  target_type: "user" | "stream";
  target_id: string;
  reason: string;
  status: ResolvableReportStatus;
  outcome: ReportOutcome | null;
  resolved_at: string | null;
}

export interface ResolveReportInput {
  reportId: string;
  outcome: ReportOutcome;
}

export interface ResolveReportResponse {
  reportId: string;
  status: "resolved";
  outcome: ReportOutcome;
  resolved_at: string;
}
