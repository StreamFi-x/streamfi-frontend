/**
 * @jest-environment node
 *
 * Tests for GET /api/routes-f/analytics-chat-engagement
 *
 * Seed summary:
 *   stream_completed_1 — 9 messages, 4 unique chatters (v1:3, v2:2, v3:3, v4:1)
 *   stream_completed_2 — 1 message, 1 unique chatter
 *   stream_live_1      — 0 messages, 0 unique chatters
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { getChatLog } from "../seed";
import { summarizeChatEngagement } from "../summarize";

function makeReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/analytics-chat-engagement${query}`
  );
}

describe("summarizeChatEngagement", () => {
  it("counts messages per unique chatter", () => {
    const log = getChatLog("stream_completed_1")!;
    const summary = summarizeChatEngagement(log);

    expect(summary.total_messages).toBe(9);
    expect(summary.unique_chatters).toBe(4);
    expect(summary.chatters).toEqual([
      { chatter_id: "v1", message_count: 3 },
      { chatter_id: "v3", message_count: 3 },
      { chatter_id: "v2", message_count: 2 },
      { chatter_id: "v4", message_count: 1 },
    ]);
  });

  it("sorts by message_count descending, then chatter_id ascending on ties", () => {
    const log = getChatLog("stream_completed_1")!;
    const { chatters } = summarizeChatEngagement(log);

    // v1 and v3 tie at 3 messages each — v1 sorts first alphabetically.
    expect(chatters[0]).toEqual({ chatter_id: "v1", message_count: 3 });
    expect(chatters[1]).toEqual({ chatter_id: "v3", message_count: 3 });
  });

  it("handles a single-message stream", () => {
    const log = getChatLog("stream_completed_2")!;
    const summary = summarizeChatEngagement(log);

    expect(summary.total_messages).toBe(1);
    expect(summary.unique_chatters).toBe(1);
    expect(summary.chatters).toEqual([{ chatter_id: "v1", message_count: 1 }]);
  });

  it("handles a stream with no chat activity", () => {
    const log = getChatLog("stream_live_1")!;
    const summary = summarizeChatEngagement(log);

    expect(summary.total_messages).toBe(0);
    expect(summary.unique_chatters).toBe(0);
    expect(summary.chatters).toEqual([]);
  });
});

describe("GET /api/routes-f/analytics-chat-engagement", () => {
  it("requires stream_id", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("stream_id");
  });

  it("404s for an unknown stream", async () => {
    const res = await GET(makeReq("?stream_id=nope"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("nope");
  });

  it("returns 200 with the full engagement summary for a known stream", async () => {
    const res = await GET(makeReq("?stream_id=stream_completed_1"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.stream_id).toBe("stream_completed_1");
    expect(body.total_messages).toBe(9);
    expect(body.unique_chatters).toBe(4);
    expect(body.chatters).toHaveLength(4);
  });

  it("returns a zeroed summary for a stream with no chat activity", async () => {
    const res = await GET(makeReq("?stream_id=stream_live_1"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.total_messages).toBe(0);
    expect(body.unique_chatters).toBe(0);
    expect(body.chatters).toEqual([]);
  });
});
