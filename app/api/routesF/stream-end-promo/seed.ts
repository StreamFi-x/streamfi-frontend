/**
 * Bundled seed for end-of-stream cross-promotion: which creators are live
 * right now, and pairwise follower overlap between creator communities.
 */

export interface LiveStream {
  stream_id: string;
  creator_id: string;
  username: string;
  category: string;
  viewers: number;
}

export const LIVE_STREAMS: LiveStream[] = [
  { stream_id: "s501", creator_id: "c101", username: "PixelQueen", category: "gaming", viewers: 1840 },
  { stream_id: "s502", creator_id: "c102", username: "LoFiLounge", category: "music", viewers: 620 },
  { stream_id: "s503", creator_id: "c103", username: "SorobanSage", category: "tech", viewers: 310 },
];

/**
 * Follower overlap between creator pairs, as a fraction of the smaller
 * community (0–1). Keys are `${a}:${b}` with a < b lexicographically.
 */
export const FOLLOW_OVERLAP: Record<string, number> = {
  "c101:c102": 0.34,
  "c101:c103": 0.12,
  "c102:c103": 0.55,
  // c199 (NicheNomad) has an isolated community — no measured overlap with
  // any currently-live creator.
  "c105:c199": 0.4,
};

export function overlapBetween(a: string, b: string): number {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  return FOLLOW_OVERLAP[key] ?? 0;
}
