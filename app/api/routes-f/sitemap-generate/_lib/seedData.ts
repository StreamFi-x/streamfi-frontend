import type { ChannelEntry, VodEntry } from "./types";

/**
 * Self-contained seed data for active channels and recent VODs, following
 * the routes-f convention of in-memory mock data per route folder (see
 * stream-quiz-create, stream-prediction-create, broadcast-live, etc.)
 * rather than a live DB query.
 */
export const ACTIVE_CHANNELS: ChannelEntry[] = [
  {
    username: "nova_streams",
    is_live: true,
    updated_at: "2026-08-27T12:00:00.000Z",
  },
  {
    username: "pixel_forge",
    is_live: true,
    updated_at: "2026-08-27T09:30:00.000Z",
  },
  {
    username: "quiet_offline_channel",
    is_live: false,
    updated_at: "2026-08-20T00:00:00.000Z",
  },
];

export const RECENT_VODS: VodEntry[] = [
  {
    id: "vod_1001",
    username: "nova_streams",
    published_at: "2026-08-26T18:00:00.000Z",
  },
  {
    id: "vod_1002",
    username: "pixel_forge",
    published_at: "2026-08-25T14:00:00.000Z",
  },
  {
    id: "vod_old_1",
    username: "pixel_forge",
    published_at: "2025-01-01T00:00:00.000Z",
  },
];
