export type ClipReportReason =
  | "nsfw"
  | "spam"
  | "copyright"
  | "abuse"
  | "other";

export const CLIP_REPORT_REASONS: ClipReportReason[] = [
  "nsfw",
  "spam",
  "copyright",
  "abuse",
  "other",
];

export type ClipReportStatus = "active" | "dismissed";

export interface ClipReport {
  report_id: string;
  clip_id: string;
  reporter_id: string;
  reason: ClipReportReason;
  description?: string;
  status: ClipReportStatus;
  created_at: string;
}

export interface ClipReportRequestBody {
  clip_id: string;
  reporter_id: string;
  reason: ClipReportReason;
  description?: string;
}

export interface ClipReportResponse {
  report_id: string;
}

export interface ClipReportCountResponse {
  clip_id: string;
  active_reports: number;
}
