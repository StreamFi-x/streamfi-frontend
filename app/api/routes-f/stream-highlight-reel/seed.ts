import type { LastSession } from "./types";

// Each entry is the most recently ended live session for a given creator.
const LAST_SESSIONS: LastSession[] = [
  {
    creator_id: "creator-001",
    stream_id: "stream-hl-1",
    ended_at: "2026-08-20T21:00:00.000Z",
    duration_seconds: 300,
    chat_events: [
      // Spike at 60-90s (20 msgs)
      ...[62, 63, 65, 66, 68, 70, 72, 74, 75, 78, 80, 81, 82, 83, 85, 86, 87, 88, 89, 90].map(
        (s) => ({ offset_seconds: s })
      ),
      // Quieter burst at 150-180s (8 msgs)
      ...[151, 155, 158, 162, 167, 170, 174, 178].map((s) => ({ offset_seconds: s })),
      // Scattered noise
      ...[10, 30, 210, 240, 270].map((s) => ({ offset_seconds: s })),
    ],
    tip_events: [
      { offset_seconds: 75, amount_usdc: 50 },
      { offset_seconds: 82, amount_usdc: 20 },
      // Tip spike at 200-230s
      { offset_seconds: 205, amount_usdc: 100 },
      { offset_seconds: 215, amount_usdc: 75 },
    ],
  },
  {
    creator_id: "creator-002",
    stream_id: "stream-hl-2",
    ended_at: "2026-08-21T18:30:00.000Z",
    duration_seconds: 600,
    chat_events: [
      ...[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((s) => ({ offset_seconds: s })),
      ...[120, 122, 125, 128, 130, 132, 135, 138, 140, 142, 145, 148, 149].map((s) => ({
        offset_seconds: s,
      })),
      ...[300, 350, 400].map((s) => ({ offset_seconds: s })),
    ],
    tip_events: [
      { offset_seconds: 130, amount_usdc: 200 },
      { offset_seconds: 145, amount_usdc: 50 },
      { offset_seconds: 10, amount_usdc: 5 },
    ],
  },
  {
    creator_id: "creator-003",
    stream_id: "stream-hl-3",
    ended_at: "2026-08-22T14:00:00.000Z",
    duration_seconds: 120,
    chat_events: [],
    tip_events: [],
  },
];

export function getLastSessionForCreator(creatorId: string): LastSession | undefined {
  return LAST_SESSIONS.find((s) => s.creator_id === creatorId);
}
