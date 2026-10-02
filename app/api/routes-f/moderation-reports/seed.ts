import type { ModerationReport } from "./types";

/**
 * Seed moderation reports for the StreamFi platform.
 *
 * creator_001  — 6 reports (4 open, 2 resolved)
 * creator_002  — 3 reports (1 open, 2 resolved)
 */
export const SEED_REPORTS: ModerationReport[] = [
  // ── creator_001 ────────────────────────────────────────────────────────────
  {
    id: "rpt_001",
    creator_id: "creator_001",
    target_type: "user",
    target_id: "user_bad_001",
    reporter_id: "viewer_101",
    reason: "Spamming offensive messages in chat",
    created_at: "2026-06-25T14:00:00Z",
    status: "open",
  },
  {
    id: "rpt_002",
    creator_id: "creator_001",
    target_type: "stream",
    target_id: "stream_abc",
    reporter_id: "viewer_102",
    reason: "Stream title contains misleading content",
    created_at: "2026-06-25T15:30:00Z",
    status: "open",
  },
  {
    id: "rpt_003",
    creator_id: "creator_001",
    target_type: "user",
    target_id: "user_bad_002",
    reporter_id: "viewer_103",
    reason: "Harassment of other viewers via XLM tip messages",
    created_at: "2026-06-26T08:00:00Z",
    status: "open",
  },
  {
    id: "rpt_004",
    creator_id: "creator_001",
    target_type: "user",
    target_id: "user_bad_003",
    reporter_id: "viewer_104",
    reason: "Impersonating the streamer in chat",
    created_at: "2026-06-26T09:15:00Z",
    status: "open",
  },
  {
    id: "rpt_005",
    creator_id: "creator_001",
    target_type: "stream",
    target_id: "stream_def",
    reporter_id: "viewer_105",
    reason: "Rebroadcasting copyrighted content without permission",
    created_at: "2026-06-20T11:00:00Z",
    status: "resolved",
  },
  {
    id: "rpt_006",
    creator_id: "creator_001",
    target_type: "user",
    target_id: "user_bad_004",
    reporter_id: "viewer_106",
    reason: "Posting wallet phishing links in tip messages",
    created_at: "2026-06-18T17:45:00Z",
    status: "resolved",
  },
  // ── creator_002 ────────────────────────────────────────────────────────────
  {
    id: "rpt_007",
    creator_id: "creator_002",
    target_type: "user",
    target_id: "user_bad_005",
    reporter_id: "viewer_201",
    reason: "Hate speech directed at other subscribers",
    created_at: "2026-06-26T10:00:00Z",
    status: "open",
  },
  {
    id: "rpt_008",
    creator_id: "creator_002",
    target_type: "stream",
    target_id: "stream_xyz",
    reporter_id: "viewer_202",
    reason: "Stream marked subscribers-only but accessible publicly",
    created_at: "2026-06-24T13:20:00Z",
    status: "resolved",
  },
  {
    id: "rpt_009",
    creator_id: "creator_002",
    target_type: "user",
    target_id: "user_bad_006",
    reporter_id: "viewer_203",
    reason: "Bot flooding the chat with spam transactions",
    created_at: "2026-06-22T09:00:00Z",
    status: "resolved",
  },
];
