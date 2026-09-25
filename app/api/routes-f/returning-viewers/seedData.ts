import type { ViewerVisitRecord } from "./types";

// Deterministic seed viewer-history — a mix of returning and first-time
// viewers per stream, so aggregation math is exactly reproducible in tests.
export const viewerHistoryStore: ViewerVisitRecord[] = [
  // stream_alpha_1 — a mix of returning and brand-new viewers.
  { stream_id: "stream_alpha_1", viewer: "viewer_a", prior_visits: 5 },
  { stream_id: "stream_alpha_1", viewer: "viewer_b", prior_visits: 3 },
  { stream_id: "stream_alpha_1", viewer: "viewer_c", prior_visits: 0 },
  { stream_id: "stream_alpha_1", viewer: "viewer_d", prior_visits: 8 },
  { stream_id: "stream_alpha_1", viewer: "viewer_e", prior_visits: 0 },
  { stream_id: "stream_alpha_1", viewer: "viewer_f", prior_visits: 1 },

  // stream_beta_2 — every viewer is brand new (no returning viewers).
  { stream_id: "stream_beta_2", viewer: "viewer_g", prior_visits: 0 },
  { stream_id: "stream_beta_2", viewer: "viewer_h", prior_visits: 0 },
  { stream_id: "stream_beta_2", viewer: "viewer_i", prior_visits: 0 },

  // stream_gamma_3 — more than 5 returning viewers, to exercise the top-5 cap.
  { stream_id: "stream_gamma_3", viewer: "viewer_j", prior_visits: 12 },
  { stream_id: "stream_gamma_3", viewer: "viewer_k", prior_visits: 2 },
  { stream_id: "stream_gamma_3", viewer: "viewer_l", prior_visits: 7 },
  { stream_id: "stream_gamma_3", viewer: "viewer_m", prior_visits: 20 },
  { stream_id: "stream_gamma_3", viewer: "viewer_n", prior_visits: 1 },
  { stream_id: "stream_gamma_3", viewer: "viewer_o", prior_visits: 15 },
  { stream_id: "stream_gamma_3", viewer: "viewer_p", prior_visits: 9 },
  { stream_id: "stream_gamma_3", viewer: "viewer_q", prior_visits: 0 },
];

export function getHistoryForStream(streamId: string): ViewerVisitRecord[] {
  return viewerHistoryStore.filter(record => record.stream_id === streamId);
}
