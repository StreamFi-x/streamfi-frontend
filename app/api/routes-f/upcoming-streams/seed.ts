import type { ScheduledStream } from "./types";

const HOUR = 60 * 60 * 1000;

/**
 * Seed schedule data. Timestamps are expressed as an offset (in hours) from
 * "now" so the data stays meaningfully "upcoming" regardless of when the route
 * is called. A negative offset represents a stream that was scheduled to start
 * in the past (already started / stale schedule) and must never be returned.
 */
interface SeedEntry extends Omit<ScheduledStream, "starts_at"> {
  starts_in_hours: number;
}

const SEED: SeedEntry[] = [
  {
    stream_id: "sched_001",
    creator_id: "creator_a",
    creator_name: "PixelQueen",
    title: "Ranked grind to Diamond",
    category: "gaming",
    privacy: "public",
    thumbnail_url: "https://stream.fi/thumbs/sched_001.jpg",
    starts_in_hours: 2,
  },
  {
    stream_id: "sched_002",
    creator_id: "creator_b",
    creator_name: "ChainTalk",
    title: "Stellar smart contracts deep dive",
    category: "crypto",
    privacy: "public",
    thumbnail_url: "https://stream.fi/thumbs/sched_002.jpg",
    starts_in_hours: 5,
  },
  {
    stream_id: "sched_003",
    creator_id: "creator_c",
    creator_name: "LoFiBeats",
    title: "Late night coding & chill",
    category: "music",
    privacy: "subscribers-only",
    thumbnail_url: "https://stream.fi/thumbs/sched_003.jpg",
    starts_in_hours: 12,
  },
  {
    stream_id: "sched_004",
    creator_id: "creator_a",
    creator_name: "PixelQueen",
    title: "Weekend speedrun marathon",
    category: "gaming",
    privacy: "public",
    thumbnail_url: "https://stream.fi/thumbs/sched_004.jpg",
    starts_in_hours: 26,
  },
  {
    stream_id: "sched_005",
    creator_id: "creator_d",
    creator_name: "ArtByMona",
    title: "Digital painting commissions",
    category: "art",
    privacy: "unlisted",
    thumbnail_url: "https://stream.fi/thumbs/sched_005.jpg",
    starts_in_hours: 40,
  },
  {
    stream_id: "sched_006",
    creator_id: "creator_b",
    creator_name: "ChainTalk",
    title: "Tipping economics AMA",
    category: "crypto",
    privacy: "public",
    thumbnail_url: "https://stream.fi/thumbs/sched_006.jpg",
    starts_in_hours: 47,
  },
  {
    stream_id: "sched_007",
    creator_id: "creator_e",
    creator_name: "CookWithKai",
    title: "Sourdough from scratch",
    category: "cooking",
    privacy: "public",
    thumbnail_url: "https://stream.fi/thumbs/sched_007.jpg",
    starts_in_hours: 72,
  },
  {
    stream_id: "sched_008",
    creator_id: "creator_c",
    creator_name: "LoFiBeats",
    title: "Synthwave live set",
    category: "music",
    privacy: "public",
    thumbnail_url: "https://stream.fi/thumbs/sched_008.jpg",
    starts_in_hours: 96,
  },
  {
    // Stale entry: was scheduled to start an hour ago. Should never be listed.
    stream_id: "sched_009",
    creator_id: "creator_a",
    creator_name: "PixelQueen",
    title: "Missed warmup stream",
    category: "gaming",
    privacy: "public",
    thumbnail_url: "https://stream.fi/thumbs/sched_009.jpg",
    starts_in_hours: -1,
  },
];

/**
 * Materialize the seed schedule into concrete scheduled streams with absolute
 * ISO timestamps, relative to the supplied reference time.
 */
export function getScheduledStreams(now: number = Date.now()): ScheduledStream[] {
  return SEED.map(({ starts_in_hours, ...rest }) => ({
    ...rest,
    starts_at: new Date(now + starts_in_hours * HOUR).toISOString(),
  }));
}
