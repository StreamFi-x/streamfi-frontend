import type { StreamData, TrendingRankingRow } from "./types";

/**
 * Source stream data this cron recomputes the ranking table from. Mirrors
 * the shape of trending-streams/route.ts's own SEED_STREAMS — kept as a
 * separate copy rather than importing that route's export, since this
 * store also needs a distinct "recently added, no prior snapshot" stream
 * (past_viewers === current_viewers, so velocity is 0) to exercise the
 * zero-velocity edge case deterministically.
 */
const SOURCE_STREAMS: StreamData[] = [
  {
    id: "stream-1",
    title: "Flat Stream",
    creator: "CreatorA",
    current_viewers: 100,
    past_viewers: 100,
  },
  {
    id: "stream-2",
    title: "Trending Stream",
    creator: "CreatorB",
    current_viewers: 150,
    past_viewers: 50, // velocity +100
  },
  {
    id: "stream-3",
    title: "Declining Stream",
    creator: "CreatorC",
    current_viewers: 120,
    past_viewers: 200, // velocity -80
  },
  {
    id: "stream-4",
    title: "Brand New Stream",
    creator: "CreatorD",
    current_viewers: 30,
    past_viewers: 30, // no prior snapshot yet — velocity 0
  },
];

/** The persisted ranking table this cron writes to. Empty until first run. */
let _rankingTable: TrendingRankingRow[] = [];

export function getSourceStreams(): StreamData[] {
  return SOURCE_STREAMS;
}

export function getRankingTable(): TrendingRankingRow[] {
  return _rankingTable;
}

export function setRankingTable(rows: TrendingRankingRow[]): void {
  _rankingTable = rows;
}

export function resetRankingTable(): void {
  _rankingTable = [];
}
