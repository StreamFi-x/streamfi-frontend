import type { ChatEngagementResponse, StreamChatLog } from "./types";

/**
 * Aggregates a stream's chat log into per-chatter message counts.
 * Chatters are sorted by message_count descending, then by chatter_id
 * ascending for a stable, deterministic tie-break.
 */
export function summarizeChatEngagement(
  log: StreamChatLog
): ChatEngagementResponse {
  const counts = new Map<string, number>();

  for (const { chatter_id } of log.messages) {
    counts.set(chatter_id, (counts.get(chatter_id) ?? 0) + 1);
  }

  const chatters = Array.from(counts.entries())
    .map(([chatter_id, message_count]) => ({ chatter_id, message_count }))
    .sort((a, b) => {
      if (b.message_count !== a.message_count) {
        return b.message_count - a.message_count;
      }
      return a.chatter_id.localeCompare(b.chatter_id);
    });

  return {
    stream_id: log.stream_id,
    unique_chatters: chatters.length,
    total_messages: log.messages.length,
    chatters,
  };
}
