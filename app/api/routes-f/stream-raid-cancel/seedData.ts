import type { Raid } from "./types";

export const raidStore = new Map<string, Raid>([
  [
    "raid_pending_1",
    {
      raid_id: "raid_pending_1",
      from_channel_id: "channel-1",
      to_channel_id: "channel-2",
      status: "pending",
      initiated_at: "2026-08-24T20:00:00.000Z",
      redirect_at: "2026-08-24T20:00:10.000Z",
      cancelled_at: null,
    },
  ],
  [
    "raid_pending_2",
    {
      raid_id: "raid_pending_2",
      from_channel_id: "channel-3",
      to_channel_id: "channel-4",
      status: "pending",
      initiated_at: "2026-08-24T21:00:00.000Z",
      redirect_at: "2026-08-24T21:00:10.000Z",
      cancelled_at: null,
    },
  ],
  [
    "raid_already_redirected",
    {
      raid_id: "raid_already_redirected",
      from_channel_id: "channel-5",
      to_channel_id: "channel-6",
      status: "redirected",
      initiated_at: "2026-08-24T19:00:00.000Z",
      redirect_at: "2026-08-24T19:00:10.000Z",
      cancelled_at: null,
    },
  ],
  [
    "raid_already_cancelled",
    {
      raid_id: "raid_already_cancelled",
      from_channel_id: "channel-7",
      to_channel_id: "channel-8",
      status: "cancelled",
      initiated_at: "2026-08-24T18:00:00.000Z",
      redirect_at: "2026-08-24T18:00:10.000Z",
      cancelled_at: "2026-08-24T18:00:05.000Z",
    },
  ],
]);
