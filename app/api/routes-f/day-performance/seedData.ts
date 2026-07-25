import type { StreamRecord } from "./types";

// Fixed calendar dates (not relative to "now") so day-of-week aggregation is
// exactly reproducible: 2026-06-01/08/15 are Mondays, 2026-06-02 is a Tuesday.
export const streamStore: StreamRecord[] = [
  {
    id: "stream_1",
    creator_id: "creator_delta",
    date: "2026-06-01T00:00:00.000Z",
    viewer_count: 100,
    tips_usdc: 50,
  },
  {
    id: "stream_2",
    creator_id: "creator_delta",
    date: "2026-06-08T00:00:00.000Z",
    viewer_count: 200,
    tips_usdc: 150,
  },
  {
    id: "stream_3",
    creator_id: "creator_delta",
    date: "2026-06-15T00:00:00.000Z",
    viewer_count: 300,
    tips_usdc: 100,
  },
  {
    id: "stream_4",
    creator_id: "creator_delta",
    date: "2026-06-02T00:00:00.000Z",
    viewer_count: 80,
    tips_usdc: 20,
  },

  // creator_epsilon — separate creator, used to verify creator_id filtering.
  {
    id: "stream_5",
    creator_id: "creator_epsilon",
    date: "2026-06-09T00:00:00.000Z",
    viewer_count: 50,
    tips_usdc: 10,
  },
];

export function getStreamsForCreator(creatorId: string): StreamRecord[] {
  return streamStore.filter(s => s.creator_id === creatorId);
}
