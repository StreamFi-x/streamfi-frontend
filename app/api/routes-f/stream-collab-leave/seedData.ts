import type { CollabSession } from "./types";

// Keyed by collab_session_id.
export const collabSessionStore = new Map<string, CollabSession>([
  [
    "collab_two_participants",
    {
      collab_session_id: "collab_two_participants",
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
    "collab_three_participants",
    {
      collab_session_id: "collab_three_participants",
      stream_id: "stream_2",
      status: "active",
      participants: [
        {
          creator_id: "creator_host_2",
          username: "host_two",
          joined_at: "2026-08-02T09:00:00.000Z",
          role: "host",
        },
        {
          creator_id: "creator_guest_a",
          username: "guest_a",
          joined_at: "2026-08-02T09:05:00.000Z",
          role: "guest",
        },
        {
          creator_id: "creator_guest_b",
          username: "guest_b",
          joined_at: "2026-08-02T09:10:00.000Z",
          role: "guest",
        },
      ],
    },
  ],
  [
    "collab_for_outsider_check",
    {
      collab_session_id: "collab_for_outsider_check",
      stream_id: "stream_5",
      status: "active",
      participants: [
        {
          creator_id: "creator_host_5",
          username: "host_five",
          joined_at: "2026-08-04T09:00:00.000Z",
          role: "host",
        },
      ],
    },
  ],
  [
    "collab_solo_host",
    {
      collab_session_id: "collab_solo_host",
      stream_id: "stream_3",
      status: "active",
      participants: [
        {
          creator_id: "creator_host_3",
          username: "solo_host",
          joined_at: "2026-08-03T09:00:00.000Z",
          role: "host",
        },
      ],
    },
  ],
  [
    "collab_ended_session",
    {
      collab_session_id: "collab_ended_session",
      stream_id: "stream_4",
      status: "ended",
      participants: [
        {
          creator_id: "creator_host_4",
          username: "past_host",
          joined_at: "2026-07-28T12:00:00.000Z",
          role: "host",
        },
      ],
    },
  ],
]);
