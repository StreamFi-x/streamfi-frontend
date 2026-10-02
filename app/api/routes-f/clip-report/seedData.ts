import type { ClipReport } from "./types";

// Keyed by report_id. A couple of pre-existing reports so GET has something
// to count against out of the box.
export const clipReportStore = new Map<string, ClipReport>([
  [
    "report_seed_1",
    {
      report_id: "report_seed_1",
      clip_id: "clip_with_reports",
      reporter_id: "viewer_seed_1",
      reason: "spam",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  [
    "report_seed_2",
    {
      report_id: "report_seed_2",
      clip_id: "clip_with_reports",
      reporter_id: "viewer_seed_2",
      reason: "nsfw",
      description: "Explicit content in thumbnail",
      status: "active",
      created_at: "2026-01-01T00:05:00.000Z",
    },
  ],
  [
    "report_seed_3",
    {
      report_id: "report_seed_3",
      clip_id: "clip_with_reports",
      reporter_id: "viewer_seed_3",
      reason: "abuse",
      status: "dismissed",
      created_at: "2025-12-30T00:00:00.000Z",
    },
  ],
]);

// reporter_id -> list of report timestamps (ms), for the rolling rate limit.
export const reporterActivity = new Map<string, number[]>();
