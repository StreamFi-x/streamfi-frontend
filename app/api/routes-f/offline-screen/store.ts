import type { OfflineScreen } from "./types";

// In-memory store keyed by creator_id
export const offlineScreenStore: Record<string, OfflineScreen> = {
  creator_alice: {
    type: "image",
    source_url: "https://cdn.streamfi.io/offline/alice-banner.png",
  },
  creator_bob: {
    type: "vod",
    vod_id: "vod_xyz123",
  },
  creator_carol: {
    type: "none",
  },
};
