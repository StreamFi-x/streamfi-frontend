import {
  publishRealtimeMessage,
  getRecentMessages,
  subscribeLocal,
  resetRealtimeForTests,
} from "@/lib/realtime/pubsub";
import {
  mintRealtimeToken,
  verifyRealtimeToken,
  isChannelAllowedForUser,
} from "@/lib/realtime/tokens";
import { RealtimeClient } from "@/lib/realtime/client";

describe("Realtime Pub/Sub Backbone (#1449)", () => {
  beforeEach(() => {
    resetRealtimeForTests();
  });

  it("publishes messages with monotonic sequence numbers and timestamps", async () => {
    const channel = "stream:test-123:chat";
    const msg1 = await publishRealtimeMessage(channel, "chat:message", {
      text: "hello world",
    });
    const msg2 = await publishRealtimeMessage(channel, "chat:message", {
      text: "second message",
    });

    expect(msg1.seq).toBe(1);
    expect(msg2.seq).toBe(2);
    expect(msg1.channel).toBe(channel);
    expect(msg2.channel).toBe(channel);
    expect(msg2.timestamp).toBeGreaterThanOrEqual(msg1.timestamp);
  });

  it("delivers messages to subscribed in-memory listeners", async () => {
    const channel = "stream:test-123:presence";
    const received: any[] = [];

    const unsub = subscribeLocal(channel, (msg) => {
      received.push(msg);
    });

    await publishRealtimeMessage(channel, "presence:update", { count: 42 });
    expect(received).toHaveLength(1);
    expect(received[0].data).toEqual({ count: 42 });

    unsub();
    await publishRealtimeMessage(channel, "presence:update", { count: 43 });
    expect(received).toHaveLength(1); // Unsubscribed
  });

  it("replays recent messages since sequence ID", async () => {
    const channel = "stream:test-123:chat";
    await publishRealtimeMessage(channel, "msg", { num: 1 });
    await publishRealtimeMessage(channel, "msg", { num: 2 });
    await publishRealtimeMessage(channel, "msg", { num: 3 });

    const all = await getRecentMessages(channel);
    expect(all).toHaveLength(3);

    const since1 = await getRecentMessages(channel, 1);
    expect(since1).toHaveLength(2);
    expect(since1[0].data).toEqual({ num: 2 });
    expect(since1[1].data).toEqual({ num: 3 });
  });

  describe("Realtime Auth Tokens", () => {
    it("mints and verifies valid scoped tokens", () => {
      const token = mintRealtimeToken(["stream:test-123:chat"], {
        userId: "user-1",
        wallet: "GAAA",
      });
      const verified = verifyRealtimeToken(token, ["stream:test-123:chat"]);

      expect(verified.ok).toBe(true);
      if (verified.ok) {
        expect(verified.payload.userId).toBe("user-1");
        expect(verified.payload.channels).toContain("stream:test-123:chat");
      }
    });

    it("rejects unauthorized channel requests", () => {
      const token = mintRealtimeToken(["stream:test-123:chat"]);
      const verified = verifyRealtimeToken(token, ["stream:secret-456:mod"]);

      expect(verified.ok).toBe(false);
    });

    it("enforces channel permission rules correctly", () => {
      expect(isChannelAllowedForUser("stream:abc:chat")).toBe(true);
      expect(isChannelAllowedForUser("stream:abc:presence")).toBe(true);
      expect(isChannelAllowedForUser("stream:abc:status")).toBe(true);

      // Private channels
      expect(isChannelAllowedForUser("creator:xyz:private")).toBe(false);
      expect(isChannelAllowedForUser("creator:xyz:private", { userId: "xyz" })).toBe(true);
      expect(isChannelAllowedForUser("stream:abc:mod")).toBe(false);
      expect(isChannelAllowedForUser("stream:abc:mod", { userId: "mod-1" })).toBe(true);
    });
  });

  describe("Realtime Client Connection & Backoff", () => {
    it("initializes in disconnected state and manages state transitions", () => {
      const client = new RealtimeClient({ baseBackoffMs: 50 });
      expect(client.getState()).toBe("disconnected");

      const states: string[] = [];
      client.onStateChange((s) => states.push(s));
      expect(states).toContain("disconnected");
    });
  });
});
