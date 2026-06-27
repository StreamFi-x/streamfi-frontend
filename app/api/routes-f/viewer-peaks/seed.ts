import type { StreamSessionPeak } from "./types";

const MINUTE = 60 * 1000;

/**
 * Seed stream sessions with viewer samples and aligned timestamps so peak
 * moments can be resolved for a creator's past streams.
 */
export function getStreamSessions(
  now: number = Date.now()
): StreamSessionPeak[] {
  return [
    {
      stream_id: "stream_peak_1",
      creator_id: "creator_a",
      title: "Stellar DeFi Deep Dive",
      viewer_samples: [120, 340, 510, 480, 620, 590, 410, 250],
      sample_timestamps: [
        "2026-06-20T18:00:00.000Z",
        "2026-06-20T18:15:00.000Z",
        "2026-06-20T18:30:00.000Z",
        "2026-06-20T18:45:00.000Z",
        "2026-06-20T19:00:00.000Z",
        "2026-06-20T19:15:00.000Z",
        "2026-06-20T19:30:00.000Z",
        "2026-06-20T19:45:00.000Z",
      ],
    },
    {
      stream_id: "stream_peak_2",
      creator_id: "creator_a",
      title: "Community AMA: XLM Tips & Tricks",
      viewer_samples: [85, 210, 450, 380, 290],
      sample_timestamps: [
        "2026-06-18T20:00:00.000Z",
        "2026-06-18T20:10:00.000Z",
        "2026-06-18T20:20:00.000Z",
        "2026-06-18T20:30:00.000Z",
        "2026-06-18T20:40:00.000Z",
      ],
    },
    {
      stream_id: "stream_peak_3",
      creator_id: "creator_a",
      title: "Late Night Chill Beats",
      viewer_samples: [42, 55, 61, 48],
      sample_timestamps: [
        "2026-06-15T23:00:00.000Z",
        "2026-06-15T23:15:00.000Z",
        "2026-06-15T23:30:00.000Z",
        "2026-06-15T23:45:00.000Z",
      ],
    },
    {
      stream_id: "stream_peak_4",
      creator_id: "creator_b",
      title: "USDC Payout Walkthrough",
      viewer_samples: [200, 310, 280],
      sample_timestamps: [
        "2026-06-19T14:00:00.000Z",
        "2026-06-19T14:20:00.000Z",
        "2026-06-19T14:40:00.000Z",
      ],
    },
    {
      // Live stream: samples relative to now for realism.
      stream_id: "stream_peak_live",
      creator_id: "creator_a",
      title: "Live: Building on StreamFi",
      viewer_samples: [80, 150, 220, 300, 410],
      sample_timestamps: [
        new Date(now - 35 * MINUTE).toISOString(),
        new Date(now - 28 * MINUTE).toISOString(),
        new Date(now - 21 * MINUTE).toISOString(),
        new Date(now - 14 * MINUTE).toISOString(),
        new Date(now - 7 * MINUTE).toISOString(),
      ],
    },
  ];
}

export function getSessionsForCreator(
  creatorId: string,
  now: number = Date.now()
): StreamSessionPeak[] {
  return getStreamSessions(now).filter(s => s.creator_id === creatorId);
}
