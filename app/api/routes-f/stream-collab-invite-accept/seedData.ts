import type { CollabInvite } from "./types";

export const collabInviteStore = new Map<string, CollabInvite>([
  [
    "invite_pending_1",
    {
      invite_id: "invite_pending_1",
      from_creator_id: "creator_a",
      to_creator_id: "creator_b",
      stream_id: "stream_1",
      status: "pending",
      created_at: "2026-01-01T00:00:00.000Z",
      resolved_at: null,
    },
  ],
  [
    "invite_pending_2",
    {
      invite_id: "invite_pending_2",
      from_creator_id: "creator_c",
      to_creator_id: "creator_d",
      stream_id: "stream_2",
      status: "pending",
      created_at: "2026-01-02T00:00:00.000Z",
      resolved_at: null,
    },
  ],
  [
    "invite_already_declined",
    {
      invite_id: "invite_already_declined",
      from_creator_id: "creator_a",
      to_creator_id: "creator_e",
      stream_id: "stream_3",
      status: "declined",
      created_at: "2025-12-01T00:00:00.000Z",
      resolved_at: "2025-12-01T01:00:00.000Z",
    },
  ],
  [
    "invite_already_accepted",
    {
      invite_id: "invite_already_accepted",
      from_creator_id: "creator_a",
      to_creator_id: "creator_f",
      stream_id: "stream_4",
      status: "accepted",
      created_at: "2025-12-02T00:00:00.000Z",
      resolved_at: "2025-12-02T01:00:00.000Z",
    },
  ],
]);
