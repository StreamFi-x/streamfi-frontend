/**
 * Types for GET /api/routes-f/moderation-reports
 */

export type ReportStatus = "open" | "resolved";

export type TargetType = "user" | "stream";

export interface ModerationReport {
  id: string;
  target_type: TargetType;
  target_id: string;
  reporter_id: string;
  reason: string;
  created_at: string;
  status: ReportStatus;
  /** The creator whose moderation queue this report belongs to */
  creator_id: string;
}

export interface ModerationReportsResponse {
  reports: Omit<ModerationReport, "creator_id">[];
  total: number;
}
