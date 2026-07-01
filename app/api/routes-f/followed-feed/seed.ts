import { CreatorStream } from "./types";

const now = new Date();

// Helpers
function hoursAgo(h: number) {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

// viewer_id -> creator_ids they follow
export const followsData: Record<string, string[]> = {
  "viewer-1": ["creator-alpha", "creator-beta", "creator-gamma", "creator-delta"],
  "viewer-2": ["creator-alpha", "creator-delta"],
  "viewer-3": ["creator-gamma"],
  "viewer-4": ["creator-epsilon"], // follows someone with no recent stream
};

// Currently live streams
export const liveStreams: CreatorStream[] = [
  {
    creator_id: "creator-alpha",
    username: "alpha_streams",
    title: "Grinding ranked — XLM tipping enabled",
    category: "Gaming",
    viewer_count: 312,
    started_at: hoursAgo(2),
  },
  {
    creator_id: "creator-beta",
    username: "beta_live",
    title: "Stellar blockchain Q&A",
    category: "Technology",
    viewer_count: 87,
    started_at: hoursAgo(1),
  },
];

// Streams that ended within the last 24 hours
export const recentlyOfflineStreams: CreatorStream[] = [
  {
    creator_id: "creator-gamma",
    username: "gamma_cast",
    title: "Chill lo-fi session",
    category: "Music",
    viewer_count: 45,
    started_at: hoursAgo(10),
    ended_at: hoursAgo(8),
  },
  {
    creator_id: "creator-delta",
    username: "delta_play",
    title: "Mux stream test",
    category: "Just Chatting",
    viewer_count: 150,
    started_at: hoursAgo(5),
    ended_at: hoursAgo(3),
  },
];
