import type { ResolvableReport } from "./types";

/**
 * Seed moderation reports available to resolve.
 *
 * report_open_1 / report_open_2 — open, awaiting a moderator decision.
 * report_resolved_1             — already resolved (banned), for the
 *                                  already-resolved conflict path.
 */
export const reportStore = new Map<string, ResolvableReport>([
  [
    "report_open_1",
    {
      reportId: "report_open_1",
      creator_id: "creator_001",
      target_type: "user",
      target_id: "user_bad_001",
      reason: "Spamming offensive messages in chat",
      status: "open",
      outcome: null,
      resolved_at: null,
    },
  ],
  [
    "report_open_2",
    {
      reportId: "report_open_2",
      creator_id: "creator_002",
      target_type: "stream",
      target_id: "stream_xyz",
      reason: "Stream marked subscribers-only but accessible publicly",
      status: "open",
      outcome: null,
      resolved_at: null,
    },
  ],
  [
    "report_resolved_1",
    {
      reportId: "report_resolved_1",
      creator_id: "creator_001",
      target_type: "user",
      target_id: "user_bad_004",
      reason: "Posting wallet phishing links in tip messages",
      status: "resolved",
      outcome: "banned",
      resolved_at: "2026-06-18T18:00:00.000Z",
    },
  ],
]);

export function resetReportStore(): void {
  reportStore.clear();
  reportStore.set("report_open_1", {
    reportId: "report_open_1",
    creator_id: "creator_001",
    target_type: "user",
    target_id: "user_bad_001",
    reason: "Spamming offensive messages in chat",
    status: "open",
    outcome: null,
    resolved_at: null,
  });
  reportStore.set("report_open_2", {
    reportId: "report_open_2",
    creator_id: "creator_002",
    target_type: "stream",
    target_id: "stream_xyz",
    reason: "Stream marked subscribers-only but accessible publicly",
    status: "open",
    outcome: null,
    resolved_at: null,
  });
  reportStore.set("report_resolved_1", {
    reportId: "report_resolved_1",
    creator_id: "creator_001",
    target_type: "user",
    target_id: "user_bad_004",
    reason: "Posting wallet phishing links in tip messages",
    status: "resolved",
    outcome: "banned",
    resolved_at: "2026-06-18T18:00:00.000Z",
  });
}
