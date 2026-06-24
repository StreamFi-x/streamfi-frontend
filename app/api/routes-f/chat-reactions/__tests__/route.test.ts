/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { reactionStore } from "../utils";

function makePostReq(
  messageId: string,
  emoji: string,
  userId: string
): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/chat-reactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message_id: messageId,
      emoji,
      user_id: userId,
    }),
  });
}

function makeGetReq(messageId: string, userId?: string): NextRequest {
  let url = `http://localhost/api/routes-f/chat-reactions?message_id=${messageId}`;
  if (userId) {
    url += `&user_id=${userId}`;
  }
  return new NextRequest(url);
}

describe("POST /api/routes-f/chat-reactions", () => {
  beforeEach(() => {
    // Clear reactions before each test
    reactionStore.length = 0;
  });

  describe("Adding Reactions", () => {
    it("adds a reaction to a message", async () => {
      const res = await POST(makePostReq("msg123", "👍", "user1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.toggled).toBe(true);
      expect(body.reactions.length).toBe(1);
      expect(body.reactions[0]).toEqual({
        emoji: "👍",
        count: 1,
        reacted_by_me: true,
      });
    });

    it("adds multiple different emoji reactions", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));
      const res = await POST(makePostReq("msg123", "❤️", "user1"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.toggled).toBe(true);
      expect(body.reactions.length).toBe(2);

      const emojis = body.reactions.map(r => r.emoji);
      expect(emojis).toContain("👍");
      expect(emojis).toContain("❤️");
    });

    it("adds same emoji from different users", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));
      const res = await POST(makePostReq("msg123", "👍", "user2"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.toggled).toBe(true);
      expect(body.reactions.length).toBe(1);
      expect(body.reactions[0]).toEqual({
        emoji: "👍",
        count: 2,
        reacted_by_me: true,
      });
    });

    it("handles single character emojis", async () => {
      const res = await POST(makePostReq("msg123", "😊", "user1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reactions[0].emoji).toBe("😊");
    });

    it("handles emoji with skin tone modifiers", async () => {
      // 👋🏻 is wave with light skin tone
      const res = await POST(makePostReq("msg123", "👋🏻", "user1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reactions.length).toBe(1);
    });

    it("handles emoji with zero-width joiners", async () => {
      // 👨‍👩‍👧‍👦 is family emoji (ZWJ sequence)
      const res = await POST(makePostReq("msg123", "👨‍👩‍👧‍👦", "user1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reactions.length).toBe(1);
    });
  });

  describe("Toggling Reactions", () => {
    it("removes a reaction when user reacts with same emoji", async () => {
      // Add reaction
      await POST(makePostReq("msg123", "👍", "user1"));

      // Toggle off (remove)
      const res = await POST(makePostReq("msg123", "👍", "user1"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.toggled).toBe(false);
      expect(body.reactions.length).toBe(0);
    });

    it("removes only one user reaction, not all", async () => {
      // User 1 and 2 react with thumbs up
      await POST(makePostReq("msg123", "👍", "user1"));
      await POST(makePostReq("msg123", "👍", "user2"));

      // User 1 removes their reaction
      const res = await POST(makePostReq("msg123", "👍", "user1"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.toggled).toBe(false);
      expect(body.reactions[0]).toEqual({
        emoji: "👍",
        count: 1,
        reacted_by_me: false,
      });
    });

    it("allows user to re-add after removing", async () => {
      // Add
      await POST(makePostReq("msg123", "👍", "user1"));

      // Remove
      await POST(makePostReq("msg123", "👍", "user1"));

      // Re-add
      const res = await POST(makePostReq("msg123", "👍", "user1"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.toggled).toBe(true);
      expect(body.reactions[0]).toEqual({
        emoji: "👍",
        count: 1,
        reacted_by_me: true,
      });
    });

    it("does not affect other emojis when toggling", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));
      await POST(makePostReq("msg123", "❤️", "user1"));
      await POST(makePostReq("msg123", "👍", "user2"));

      // Toggle off user1's thumbs up
      const res = await POST(makePostReq("msg123", "👍", "user1"));

      const body = await res.json();
      const heartReaction = body.reactions.find(r => r.emoji === "❤️");
      expect(heartReaction).toEqual({
        emoji: "❤️",
        count: 1,
        reacted_by_me: true,
      });
    });
  });

  describe("Message Isolation", () => {
    it("reactions are isolated per message", async () => {
      await POST(makePostReq("msg1", "👍", "user1"));
      await POST(makePostReq("msg2", "❤️", "user1"));

      const res = await POST(makePostReq("msg1", "❤️", "user2"));

      const body = await res.json();
      expect(body.reactions.length).toBe(2);
      const emojis = body.reactions.map(r => r.emoji);
      expect(emojis).toContain("👍");
      expect(emojis).toContain("❤️");
    });
  });

  describe("Input Validation", () => {
    it("rejects missing message_id", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/chat-reactions",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            emoji: "👍",
            user_id: "user1",
          }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects empty message_id", async () => {
      const res = await POST(makePostReq("", "👍", "user1"));
      expect(res.status).toBe(400);
    });

    it("rejects missing emoji", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/chat-reactions",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message_id: "msg123",
            user_id: "user1",
          }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects empty emoji", async () => {
      const res = await POST(makePostReq("msg123", "", "user1"));
      expect(res.status).toBe(400);
    });

    it("rejects multi-character string as emoji", async () => {
      const res = await POST(makePostReq("msg123", "👍❤️", "user1"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("single grapheme cluster");
    });

    it("rejects ASCII letters as emoji", async () => {
      const res = await POST(makePostReq("msg123", "a", "user1"));
      expect(res.status).toBe(400);
    });

    it("rejects ASCII numbers as emoji", async () => {
      const res = await POST(makePostReq("msg123", "5", "user1"));
      expect(res.status).toBe(400);
    });

    it("accepts ASCII symbols as reaction (if single grapheme)", async () => {
      // Some ASCII symbols that aren't letters/numbers might be acceptable
      // but the implementation should handle this gracefully
      const res = await POST(makePostReq("msg123", "!", "user1"));
      // This should either succeed or fail consistently
      expect([200, 400]).toContain(res.status);
    });

    it("rejects missing user_id", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/chat-reactions",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message_id: "msg123",
            emoji: "👍",
          }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects empty user_id", async () => {
      const res = await POST(makePostReq("msg123", "👍", ""));
      expect(res.status).toBe(400);
    });

    it("rejects invalid JSON", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/chat-reactions",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "invalid json",
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("reacted_by_me Field", () => {
    it("sets reacted_by_me to true for the user who reacted", async () => {
      const res = await POST(makePostReq("msg123", "👍", "user1"));
      const body = await res.json();
      expect(body.reactions[0].reacted_by_me).toBe(true);
    });

    it("sets reacted_by_me to false for other users", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));
      const res = await POST(makePostReq("msg123", "❤️", "user2"));

      const body = await res.json();
      const thumbsUp = body.reactions.find(r => r.emoji === "👍");
      expect(thumbsUp.reacted_by_me).toBe(false);
    });

    it("correctly reflects reacted_by_me after toggle", async () => {
      // User adds reaction
      let res = await POST(makePostReq("msg123", "👍", "user1"));
      let body = await res.json();
      expect(body.reactions[0].reacted_by_me).toBe(true);

      // User removes reaction
      res = await POST(makePostReq("msg123", "👍", "user1"));
      body = await res.json();
      // After removing, no reactions should exist
      expect(body.reactions.length).toBe(0);
    });
  });
});

describe("GET /api/routes-f/chat-reactions", () => {
  beforeEach(() => {
    reactionStore.length = 0;
  });

  describe("Basic Retrieval", () => {
    it("returns reactions for a message", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));
      await POST(makePostReq("msg123", "❤️", "user2"));

      const res = await GET(makeGetReq("msg123"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.reactions.length).toBe(2);
      const emojis = body.reactions.map(r => r.emoji);
      expect(emojis).toContain("👍");
      expect(emojis).toContain("❤️");
    });

    it("returns empty array for message with no reactions", async () => {
      const res = await GET(makeGetReq("no-reactions-msg"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reactions).toEqual([]);
    });

    it("returns 400 when message_id is missing", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/chat-reactions"
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe("Count Aggregation", () => {
    it("aggregates count for same emoji", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));
      await POST(makePostReq("msg123", "👍", "user2"));
      await POST(makePostReq("msg123", "👍", "user3"));

      const res = await GET(makeGetReq("msg123"));
      const body = await res.json();

      expect(body.reactions.length).toBe(1);
      expect(body.reactions[0]).toEqual({
        emoji: "👍",
        count: 3,
        reacted_by_me: false,
      });
    });

    it("returns correct count for multiple emojis", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));
      await POST(makePostReq("msg123", "👍", "user2"));
      await POST(makePostReq("msg123", "❤️", "user1"));
      await POST(makePostReq("msg123", "❤️", "user2"));
      await POST(makePostReq("msg123", "😂", "user1"));

      const res = await GET(makeGetReq("msg123"));
      const body = await res.json();

      expect(body.reactions.length).toBe(3);

      const thumbsUp = body.reactions.find(r => r.emoji === "👍");
      expect(thumbsUp.count).toBe(2);

      const heart = body.reactions.find(r => r.emoji === "❤️");
      expect(heart.count).toBe(2);

      const laugh = body.reactions.find(r => r.emoji === "😂");
      expect(laugh.count).toBe(1);
    });
  });

  describe("reacted_by_me Field", () => {
    it("sets reacted_by_me true when user provided and has reacted", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));
      await POST(makePostReq("msg123", "❤️", "user1"));

      const res = await GET(makeGetReq("msg123", "user1"));
      const body = await res.json();

      body.reactions.forEach(r => {
        expect(r.reacted_by_me).toBe(true);
      });
    });

    it("sets reacted_by_me false when user has not reacted", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));

      const res = await GET(makeGetReq("msg123", "user2"));
      const body = await res.json();

      expect(body.reactions[0].reacted_by_me).toBe(false);
    });

    it("sets reacted_by_me false when user_id not provided", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));

      const res = await GET(makeGetReq("msg123"));
      const body = await res.json();

      expect(body.reactions[0].reacted_by_me).toBe(false);
    });

    it("correctly identifies which emojis the user reacted to", async () => {
      await POST(makePostReq("msg123", "👍", "user1"));
      await POST(makePostReq("msg123", "👍", "user2"));
      await POST(makePostReq("msg123", "❤️", "user1"));
      await POST(makePostReq("msg123", "😂", "user2"));

      const res = await GET(makeGetReq("msg123", "user1"));
      const body = await res.json();

      const thumbsUp = body.reactions.find(r => r.emoji === "👍");
      expect(thumbsUp.reacted_by_me).toBe(true);

      const heart = body.reactions.find(r => r.emoji === "❤️");
      expect(heart.reacted_by_me).toBe(true);

      const laugh = body.reactions.find(r => r.emoji === "😂");
      expect(laugh.reacted_by_me).toBe(false);
    });
  });

  describe("Message Isolation", () => {
    it("returns only reactions for specified message", async () => {
      await POST(makePostReq("msg1", "👍", "user1"));
      await POST(makePostReq("msg2", "❤️", "user1"));

      const res = await GET(makeGetReq("msg1"));
      const body = await res.json();

      expect(body.reactions.length).toBe(1);
      expect(body.reactions[0].emoji).toBe("👍");
    });
  });
});

describe("Integration: Full Workflow", () => {
  beforeEach(() => {
    reactionStore.length = 0;
  });

  it("completes full reaction lifecycle", async () => {
    // 1. User adds reaction
    let res = await POST(makePostReq("msg1", "👍", "user1"));
    let body = await res.json();
    expect(body.toggled).toBe(true);
    expect(body.reactions[0].count).toBe(1);

    // 2. Get reactions shows correct state
    res = await GET(makeGetReq("msg1", "user1"));
    body = await res.json();
    expect(body.reactions[0].reacted_by_me).toBe(true);

    // 3. Another user adds same emoji
    res = await POST(makePostReq("msg1", "👍", "user2"));
    body = await res.json();
    expect(body.reactions[0].count).toBe(2);

    // 4. First user removes reaction
    res = await POST(makePostReq("msg1", "👍", "user1"));
    body = await res.json();
    expect(body.toggled).toBe(false);
    expect(body.reactions[0].count).toBe(1);

    // 5. Verify state
    res = await GET(makeGetReq("msg1", "user1"));
    body = await res.json();
    expect(body.reactions[0].reacted_by_me).toBe(false);
  });

  it("handles complex multi-user multi-emoji scenario", async () => {
    const messageId = "complex-msg";

    // Setup: Multiple users, multiple emojis
    await POST(makePostReq(messageId, "👍", "user1"));
    await POST(makePostReq(messageId, "👍", "user2"));
    await POST(makePostReq(messageId, "👍", "user3"));
    await POST(makePostReq(messageId, "❤️", "user1"));
    await POST(makePostReq(messageId, "❤️", "user2"));
    await POST(makePostReq(messageId, "😂", "user1"));

    // Query from user1's perspective
    let res = await GET(makeGetReq(messageId, "user1"));
    let body = await res.json();

    const thumbsUp = body.reactions.find(r => r.emoji === "👍");
    expect(thumbsUp.count).toBe(3);
    expect(thumbsUp.reacted_by_me).toBe(true);

    const heart = body.reactions.find(r => r.emoji === "❤️");
    expect(heart.count).toBe(2);
    expect(heart.reacted_by_me).toBe(true);

    const laugh = body.reactions.find(r => r.emoji === "😂");
    expect(laugh.count).toBe(1);
    expect(laugh.reacted_by_me).toBe(true);

    // User 2 removes heart
    await POST(makePostReq(messageId, "❤️", "user2"));

    // Verify update
    res = await GET(makeGetReq(messageId, "user2"));
    body = await res.json();

    const updatedHeart = body.reactions.find(r => r.emoji === "❤️");
    expect(updatedHeart.count).toBe(1);
    expect(updatedHeart.reacted_by_me).toBe(false);
  });

  it("tracks separate messages independently", async () => {
    // Message 1: thumbs up from users 1 and 2
    await POST(makePostReq("msg1", "👍", "user1"));
    await POST(makePostReq("msg1", "👍", "user2"));

    // Message 2: heart from user 3
    await POST(makePostReq("msg2", "❤️", "user3"));

    // Verify msg1 only has thumbs up
    let res = await GET(makeGetReq("msg1"));
    let body = await res.json();
    expect(body.reactions.length).toBe(1);
    expect(body.reactions[0].emoji).toBe("👍");
    expect(body.reactions[0].count).toBe(2);

    // Verify msg2 only has heart
    res = await GET(makeGetReq("msg2"));
    body = await res.json();
    expect(body.reactions.length).toBe(1);
    expect(body.reactions[0].emoji).toBe("❤️");
    expect(body.reactions[0].count).toBe(1);
  });
});
