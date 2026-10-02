import type { ClipRecord } from "./types";

const now = Date.now();
const h = 60 * 60 * 1000;
const d = 24 * h;

export const clipSeed: ClipRecord[] = [
  // creator_a clips
  {
    clip_id: "clip_001",
    creator_id: "creator_a",
    title: "Insane 1v5 clutch",
    duration_seconds: 30,
    likes: 4820,
    created_at: now - 2 * h,
    thumbnail_url: "https://stream.fi/thumbs/clip_001.jpg",
    vod_id: "vod_a1",
  },
  {
    clip_id: "clip_002",
    creator_id: "creator_a",
    title: "World record speedrun attempt",
    duration_seconds: 60,
    likes: 3102,
    created_at: now - 5 * h,
    thumbnail_url: "https://stream.fi/thumbs/clip_002.jpg",
    vod_id: "vod_a2",
  },
  {
    clip_id: "clip_003",
    creator_id: "creator_a",
    title: "Epic fail compilation",
    duration_seconds: 45,
    likes: 1280,
    created_at: now - 10 * d,
    thumbnail_url: "https://stream.fi/thumbs/clip_003.jpg",
    vod_id: "vod_a3",
  },
  {
    clip_id: "clip_004",
    creator_id: "creator_a",
    title: "Pro tips for beginners",
    duration_seconds: 90,
    likes: 875,
    created_at: now - 25 * d,
    thumbnail_url: "https://stream.fi/thumbs/clip_004.jpg",
    vod_id: "vod_a4",
  },
  // creator_b clips
  {
    clip_id: "clip_005",
    creator_id: "creator_b",
    title: "Biggest tip ever received",
    duration_seconds: 20,
    likes: 9540,
    created_at: now - 1 * h,
    thumbnail_url: "https://stream.fi/thumbs/clip_005.jpg",
    vod_id: "vod_b1",
  },
  {
    clip_id: "clip_006",
    creator_id: "creator_b",
    title: "Subscriber milestone reached",
    duration_seconds: 35,
    likes: 6210,
    created_at: now - 3 * h,
    thumbnail_url: "https://stream.fi/thumbs/clip_006.jpg",
    vod_id: "vod_b2",
  },
  {
    clip_id: "clip_007",
    creator_id: "creator_b",
    title: "5000 XLM tip reaction",
    duration_seconds: 25,
    likes: 2340,
    created_at: now - 8 * d,
    thumbnail_url: "https://stream.fi/thumbs/clip_007.jpg",
    vod_id: "vod_b3",
  },
  {
    clip_id: "clip_008",
    creator_id: "creator_b",
    title: "Late night stream highlights",
    duration_seconds: 55,
    likes: 430,
    created_at: now - 35 * d,
    thumbnail_url: "https://stream.fi/thumbs/clip_008.jpg",
    vod_id: "vod_b4",
  },
  // creator_c clips
  {
    clip_id: "clip_009",
    creator_id: "creator_c",
    title: "Blockchain tutorial clip",
    duration_seconds: 60,
    likes: 1600,
    created_at: now - 6 * d,
    thumbnail_url: "https://stream.fi/thumbs/clip_009.jpg",
    vod_id: "vod_c1",
  },
  {
    clip_id: "clip_010",
    creator_id: "creator_c",
    title: "Stellar wallet setup",
    duration_seconds: 40,
    likes: 720,
    created_at: now - 22 * h,
    thumbnail_url: "https://stream.fi/thumbs/clip_010.jpg",
    vod_id: "vod_c2",
  },
];

export function getClips(creatorId?: string): ClipRecord[] {
  if (creatorId) {return clipSeed.filter(c => c.creator_id === creatorId);}
  return clipSeed;
}
