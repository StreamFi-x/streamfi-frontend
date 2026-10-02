/**
 * Bundled third-party safety list (mock).
 *
 * In production this would be a vendor feed; here it is a fixed seed so the
 * endpoint is deterministic and self-contained. `list_source` identifies
 * which vendor list an entry came from.
 */

export const KNOWN_SOURCES = ["global-blocklist", "csam-watch", "fraud-net"] as const;

export type SafetyListSource = (typeof KNOWN_SOURCES)[number];

export interface SafetyListEntry {
  viewer_id: string;
  list_source: SafetyListSource;
  flagged_at: string; // ISO date
}

export const SAFETY_LIST: SafetyListEntry[] = [
  { viewer_id: "v_banned_001", list_source: "global-blocklist", flagged_at: "2026-01-14T09:30:00Z" },
  { viewer_id: "v_banned_002", list_source: "global-blocklist", flagged_at: "2026-02-02T18:12:00Z" },
  { viewer_id: "v_fraud_010", list_source: "fraud-net", flagged_at: "2026-03-21T11:45:00Z" },
  { viewer_id: "v_fraud_011", list_source: "fraud-net", flagged_at: "2026-05-08T22:05:00Z" },
  { viewer_id: "v_csam_100", list_source: "csam-watch", flagged_at: "2026-04-30T04:20:00Z" },
];
