export interface LiveStreamEntry {
  stream_id: string;
  creator_id: string;
  title: string;
  tags: string[];
  viewers_now: number;
}

export interface VodEntry {
  vod_id: string;
  creator_id: string;
  title: string;
  tags: string[];
  views: number;
}

export interface ClipEntry {
  clip_id: string;
  creator_id: string;
  title: string;
  tags: string[];
  likes: number;
}

export interface CreatorEntry {
  creator_id: string;
  display_name: string;
  tags: string[];
  followers: number;
  joined_days_ago: number;
}

export interface ViewerHistory {
  watched_tags: string[];
  watched_creators: string[];
}

export const LIVE_STREAMS: LiveStreamEntry[] = [
  {
    stream_id: "ls-001",
    creator_id: "creator-alpha",
    title: "Late Night Gaming",
    tags: ["gaming", "fps"],
    viewers_now: 12500,
  },
  {
    stream_id: "ls-002",
    creator_id: "creator-beta",
    title: "Coding in Public",
    tags: ["coding", "tech"],
    viewers_now: 4200,
  },
  {
    stream_id: "ls-003",
    creator_id: "creator-delta",
    title: "Music Production Live",
    tags: ["music", "production"],
    viewers_now: 8800,
  },
  {
    stream_id: "ls-004",
    creator_id: "creator-eta",
    title: "Cooking With Friends",
    tags: ["cooking", "lifestyle"],
    viewers_now: 3100,
  },
  {
    stream_id: "ls-005",
    creator_id: "creator-theta",
    title: "Tech Talk",
    tags: ["tech", "coding"],
    viewers_now: 6600,
  },
];

export const VODS: VodEntry[] = [
  {
    vod_id: "vod-001",
    creator_id: "creator-alpha",
    title: "Best Gaming Moments",
    tags: ["gaming", "highlights"],
    views: 50000,
  },
  {
    vod_id: "vod-002",
    creator_id: "creator-beta",
    title: "Build a REST API",
    tags: ["coding", "tutorial"],
    views: 30000,
  },
  {
    vod_id: "vod-003",
    creator_id: "creator-delta",
    title: "Mixing Masterclass",
    tags: ["music", "tutorial"],
    views: 22000,
  },
  {
    vod_id: "vod-004",
    creator_id: "creator-eta",
    title: "Pasta from Scratch",
    tags: ["cooking", "tutorial"],
    views: 18000,
  },
  {
    vod_id: "vod-005",
    creator_id: "creator-theta",
    title: "AI Explained Simply",
    tags: ["tech", "education"],
    views: 41000,
  },
];

export const CLIPS: ClipEntry[] = [
  {
    clip_id: "clip-001",
    creator_id: "creator-alpha",
    title: "Insane 360 No-scope",
    tags: ["gaming", "fps"],
    likes: 9800,
  },
  {
    clip_id: "clip-002",
    creator_id: "creator-beta",
    title: "Bug Fixed in 30 Seconds",
    tags: ["coding", "funny"],
    likes: 6200,
  },
  {
    clip_id: "clip-003",
    creator_id: "creator-delta",
    title: "Drop That Beat",
    tags: ["music", "production"],
    likes: 7400,
  },
  {
    clip_id: "clip-004",
    creator_id: "creator-eta",
    title: "Perfect Carbonara",
    tags: ["cooking", "tips"],
    likes: 5100,
  },
  {
    clip_id: "clip-005",
    creator_id: "creator-theta",
    title: "When ChatGPT Goes Wrong",
    tags: ["tech", "funny"],
    likes: 8300,
  },
];

export const CREATORS: CreatorEntry[] = [
  {
    creator_id: "creator-new-1",
    display_name: "FreshPixels",
    tags: ["art", "design"],
    followers: 120,
    joined_days_ago: 5,
  },
  {
    creator_id: "creator-new-2",
    display_name: "ByteNinja",
    tags: ["coding", "tech"],
    followers: 88,
    joined_days_ago: 3,
  },
  {
    creator_id: "creator-new-3",
    display_name: "VocalVibes",
    tags: ["music", "covers"],
    followers: 210,
    joined_days_ago: 7,
  },
  {
    creator_id: "creator-new-4",
    display_name: "SpeedrunQueen",
    tags: ["gaming", "speedrun"],
    followers: 65,
    joined_days_ago: 2,
  },
];

/**
 * Known viewer history. Viewers not present here are treated as cold-start.
 */
export const VIEWER_HISTORY: Map<string, ViewerHistory> = new Map([
  [
    "viewer-power",
    {
      watched_tags: ["gaming", "fps", "coding"],
      watched_creators: ["creator-alpha", "creator-beta"],
    },
  ],
  [
    "viewer-music-fan",
    {
      watched_tags: ["music", "production"],
      watched_creators: ["creator-delta"],
    },
  ],
]);
