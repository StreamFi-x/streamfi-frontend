import type { FeaturedStreamEntry } from "./types";

/**
 * The current featured-streams carousel, in editorial display order
 * (`position` ascending). Distinct from featured-stream/'s single
 * "stream of the day" pick — this is the ordered list of streams shown in
 * the homepage carousel.
 */
export const FEATURED_STREAMS: FeaturedStreamEntry[] = [
  {
    position: 1,
    creator_id: "creator_101",
    creator_username: "gaming_guru",
    stream_id: "stream_101_001",
    stream_title: "VALORANT Tournament Finals - Live Commentary",
    category: "Gaming",
    viewer_count: 12500,
    is_live: true,
  },
  {
    position: 2,
    creator_id: "creator_102",
    creator_username: "music_maestro",
    stream_id: "stream_102_001",
    stream_title: "Late Night Acoustic Session",
    category: "Music",
    viewer_count: 3400,
    is_live: true,
  },
  {
    position: 3,
    creator_id: "creator_103",
    creator_username: "chef_creates",
    stream_id: "stream_103_001",
    stream_title: "Cooking Live: Weeknight Pasta",
    category: "Food & Cooking",
    viewer_count: 890,
    is_live: false,
  },
];
