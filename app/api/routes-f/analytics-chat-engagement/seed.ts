import type { StreamChatLog } from "./types";

/**
 * Seed chat logs for the StreamFi platform.
 *
 * stream_completed_1 — creator_a — 9 messages across 4 unique chatters
 * stream_completed_2 — creator_b — 1 message, 1 unique chatter
 * stream_live_1      — creator_c — 0 messages (no chat activity yet)
 */
export const SEED_CHAT_LOGS: StreamChatLog[] = [
  {
    stream_id: "stream_completed_1",
    creator_id: "creator_a",
    messages: [
      { chatter_id: "v1", sent_at: "2026-06-20T18:05:00.000Z" },
      { chatter_id: "v1", sent_at: "2026-06-20T18:10:00.000Z" },
      { chatter_id: "v1", sent_at: "2026-06-20T18:20:00.000Z" },
      { chatter_id: "v2", sent_at: "2026-06-20T18:06:00.000Z" },
      { chatter_id: "v2", sent_at: "2026-06-20T18:15:00.000Z" },
      { chatter_id: "v3", sent_at: "2026-06-20T18:30:00.000Z" },
      { chatter_id: "v3", sent_at: "2026-06-20T18:31:00.000Z" },
      { chatter_id: "v3", sent_at: "2026-06-20T18:45:00.000Z" },
      { chatter_id: "v4", sent_at: "2026-06-20T19:00:00.000Z" },
    ],
  },
  {
    stream_id: "stream_completed_2",
    creator_id: "creator_b",
    messages: [{ chatter_id: "v1", sent_at: "2026-06-21T12:10:00.000Z" }],
  },
  {
    stream_id: "stream_live_1",
    creator_id: "creator_c",
    messages: [],
  },
];

export function getChatLog(streamId: string): StreamChatLog | undefined {
  return SEED_CHAT_LOGS.find((log) => log.stream_id === streamId);
}
