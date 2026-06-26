import type { ViewerSession } from "./types";

/**
 * Seed viewer sessions with referrer attribution.
 *
 * stream_1 has a mix across all four sources; stream_2 is smaller and lacks any
 * "embed" traffic so callers can verify zero-fill behaviour is NOT assumed
 * (absent sources are simply omitted).
 */
export const viewerSessions: ViewerSession[] = [
  { stream_id: "stream_1", viewer_id: "v1", source: "direct" },
  { stream_id: "stream_1", viewer_id: "v2", source: "direct" },
  { stream_id: "stream_1", viewer_id: "v3", source: "explore" },
  { stream_id: "stream_1", viewer_id: "v4", source: "explore" },
  { stream_id: "stream_1", viewer_id: "v5", source: "explore" },
  { stream_id: "stream_1", viewer_id: "v6", source: "social" },
  { stream_id: "stream_1", viewer_id: "v7", source: "social" },
  { stream_id: "stream_1", viewer_id: "v8", source: "social" },
  { stream_id: "stream_1", viewer_id: "v9", source: "social" },
  { stream_id: "stream_1", viewer_id: "v10", source: "embed" },

  { stream_id: "stream_2", viewer_id: "v11", source: "direct" },
  { stream_id: "stream_2", viewer_id: "v12", source: "social" },
  { stream_id: "stream_2", viewer_id: "v13", source: "social" },
  { stream_id: "stream_2", viewer_id: "v14", source: "explore" },
];

export function sessionsForStream(streamId: string): ViewerSession[] {
  return viewerSessions.filter(s => s.stream_id === streamId);
}
