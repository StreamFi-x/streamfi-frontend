import type { StreamSession } from "./types";

const MINUTE = 60 * 1000;

/**
 * Seed session data. The live session's `started_at` is expressed relative to
 * "now" so its computed duration stays current; completed sessions use fixed
 * start/end timestamps.
 */
export function getSessions(now: number = Date.now()): StreamSession[] {
  return [
    {
      // Completed stream: ran for exactly 120 minutes.
      stream_id: "stream_completed_1",
      creator_id: "creator_a",
      status: "completed",
      started_at: new Date("2026-06-20T18:00:00.000Z").toISOString(),
      ended_at: new Date("2026-06-20T20:00:00.000Z").toISOString(),
      viewer_samples: [120, 340, 510, 480, 620, 590, 410, 250],
      unique_viewer_ids: [
        "v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8",
        "v9", "v10", "v11", "v12",
      ],
      messages: 1843,
      tips_usdc: [5, 10, 25, 2.5, 100, 50, 7.5, 15],
    },
    {
      // Another completed stream with no tips and a single viewer sample.
      stream_id: "stream_completed_2",
      creator_id: "creator_b",
      status: "completed",
      started_at: new Date("2026-06-21T12:00:00.000Z").toISOString(),
      ended_at: new Date("2026-06-21T12:45:00.000Z").toISOString(),
      viewer_samples: [42],
      unique_viewer_ids: ["v1", "v2", "v3"],
      messages: 96,
      tips_usdc: [],
    },
    {
      // Live stream: started 35 minutes ago, still in progress.
      stream_id: "stream_live_1",
      creator_id: "creator_c",
      status: "live",
      started_at: new Date(now - 35 * MINUTE).toISOString(),
      ended_at: null,
      viewer_samples: [80, 150, 220, 300, 410],
      unique_viewer_ids: ["v1", "v2", "v3", "v4", "v5", "v6", "v7"],
      messages: 512,
      tips_usdc: [3, 8, 12.5, 40],
    },
  ];
}

export function getSession(
  streamId: string,
  now: number = Date.now()
): StreamSession | undefined {
  return getSessions(now).find(s => s.stream_id === streamId);
}
