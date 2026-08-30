import type { HostModeState } from "./types";

// Keyed by channel_id. `hosted_channel_id: null` means the channel is not
// currently hosting anyone.
export const hostModeStore = new Map<string, HostModeState>([
  [
    "channel-1",
    {
      channel_id: "channel-1",
      hosted_channel_id: "channel-2",
      started_at: "2026-08-20T18:00:00.000Z",
    },
  ],
  [
    "channel-3",
    {
      channel_id: "channel-3",
      hosted_channel_id: null,
      started_at: null,
    },
  ],
]);
