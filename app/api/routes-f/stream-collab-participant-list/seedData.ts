import type { CollabSession } from "./types";

// Keyed by collab_session_id.
export const collabSessionStore = new Map<string, CollabSession>([
  [
    "collab_active_two_participants",
    {
      collab_session_id: "collab_active_two_participants",
      stream_id: "stream_1",
      status: "active",
      participants: [
        {
          creator_id: "creator_host",
          username: "host_streamer",
          joined_at: "2026-08-01T10:00:00.000Z",
          role: "host",
        },
        {
          creator_id: "creator_guest",
          username: "guest_streamer",
          joined_at: "2026-08-01T10:05:00.000Z",
          role: "guest",
        },
      ],
    },
  ],
  [
    "collab_active_solo_host",
    {
      collab_session_id: "collab_active_solo_host",
      stream_id: "stream_2",
      status: "active",
      participants: [
        {
          creator_id: "creator_host_2",
          username: "solo_host",
          joined_at: "2026-08-02T09:00:00.000Z",
          role: "host",
        },
      ],
    },
  ],
  [
    "collab_ended_session",
    {
      collab_session_id: "collab_ended_session",
      stream_id: "stream_3",
      status: "ended",
      participants: [
        {
          creator_id: "creator_host_3",
          username: "past_host",
          joined_at: "2026-07-28T12:00:00.000Z",
          role: "host",
        },
      ],
    },
  ],
]);
