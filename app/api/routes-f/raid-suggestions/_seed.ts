export interface LiveStream {
  creator_id: string;
  viewers_now: number;
  shared_followers: number;
  is_live: boolean;
}

export const LIVE_STREAMS: LiveStream[] = [
  {
    creator_id: "creator-alpha",
    viewers_now: 12500,
    shared_followers: 340,
    is_live: true,
  },
  {
    creator_id: "creator-beta",
    viewers_now: 8200,
    shared_followers: 210,
    is_live: true,
  },
  {
    creator_id: "creator-gamma",
    viewers_now: 4700,
    shared_followers: 95,
    is_live: false,
  },
  {
    creator_id: "creator-delta",
    viewers_now: 22000,
    shared_followers: 510,
    is_live: true,
  },
  {
    creator_id: "creator-epsilon",
    viewers_now: 3100,
    shared_followers: 60,
    is_live: true,
  },
  {
    creator_id: "creator-zeta",
    viewers_now: 9900,
    shared_followers: 175,
    is_live: false,
  },
  {
    creator_id: "creator-eta",
    viewers_now: 1800,
    shared_followers: 420,
    is_live: true,
  },
  {
    creator_id: "creator-theta",
    viewers_now: 6600,
    shared_followers: 290,
    is_live: true,
  },
];

/**
 * Set of "follower_id:creator_id" pairs that are mutually blocked.
 * Stored as "a:b" — the raiding creator (a) cannot raid (b).
 */
export const BLOCKED_PAIRS: Set<string> = new Set([
  "creator-alpha:creator-beta",
  "creator-delta:creator-eta",
]);
