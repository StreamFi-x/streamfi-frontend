import { ScheduledStream } from "./types";

/**
 * Seed schedule bundled in-folder — stands in for the streams table.
 */
export const SEED_SCHEDULE: ScheduledStream[] = [
  {
    id: "stream_001",
    creator_id: "creator_123",
    title: "Soroban Contract Deep Dive",
    description: "Walking through a tipping contract, line by line.",
    category: "crypto",
    starts_at: "2026-01-05T18:00:00.000Z",
    duration_minutes: 120,
    privacy: "public",
  },
  {
    id: "stream_002",
    creator_id: "creator_123",
    title: "Speedrun Saturday: Any% Attempts",
    description: "Chasing a sub-40 personal best; tips in XLM welcome.",
    category: "gaming",
    starts_at: "2026-01-10T20:30:00.000Z",
    duration_minutes: 180,
    privacy: "public",
  },
  {
    id: "stream_003",
    creator_id: "creator_123",
    title: "Subscriber Q&A; behind the setup",
    description: "Subs only: rig tour, overlay stack, and payout workflow.",
    category: "irl",
    starts_at: "2026-01-14T17:00:00.000Z",
    duration_minutes: 60,
    privacy: "subscribers-only",
  },
  {
    id: "stream_004",
    creator_id: "creator_456",
    title: "Late Night DJ Set",
    description: "Two hours of house, no talking.",
    category: "music",
    starts_at: "2026-01-06T23:00:00.000Z",
    duration_minutes: 150,
    privacy: "unlisted",
  },
  {
    id: "stream_005",
    creator_id: "creator_456",
    title: "Producing in Public",
    description: "Building a track from a single sample.",
    category: "music",
    starts_at: "2026-01-13T19:00:00.000Z",
    duration_minutes: 90,
    privacy: "public",
  },
];

export function scheduleForCreator(creatorId: string): ScheduledStream[] {
  return SEED_SCHEDULE.filter(stream => stream.creator_id === creatorId);
}
