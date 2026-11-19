import {
  getRecentMessages,
  isEphemeralChannel,
  publishRealtimeMessage,
  resetRealtimeForTests,
  subscribeLocal,
} from "@/lib/realtime/pubsub";
import { isChannelAllowedForUser } from "@/lib/realtime/tokens";

jest.mock("@/lib/upstash-redis", () => ({ getUpstashRedis: () => null }));

describe("ephemeral typing channel", () => {
  beforeEach(() => resetRealtimeForTests());

  it("only typing channels are ephemeral", () => {
    expect(isEphemeralChannel("stream:abc:typing")).toBe(true);
    expect(isEphemeralChannel("stream:abc:chat")).toBe(false);
  });

  it("delivers to live subscribers but is never retained for replay", async () => {
    const received: string[] = [];
    subscribeLocal("stream:abc:typing", m => received.push(m.event));

    await publishRealtimeMessage("stream:abc:typing", "chat:typing", {});

    expect(received).toEqual(["chat:typing"]);
    expect(await getRecentMessages("stream:abc:typing")).toEqual([]);
  });

  it("still retains the chat channel for replay", async () => {
    await publishRealtimeMessage("stream:abc:chat", "chat:message", {});
    expect(await getRecentMessages("stream:abc:chat")).toHaveLength(1);
  });

  it("is subscribable by anonymous viewers", () => {
    expect(isChannelAllowedForUser("stream:abc:typing")).toBe(true);
  });
});

describe("ephemeral channel in Redis", () => {
  it("uses a short TTL and small cap instead of the 1h history", async () => {
    jest.resetModules();
    const redis = {
      incr: jest.fn().mockResolvedValue(1),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      expire: jest.fn(),
      publish: jest.fn(),
    };
    jest.doMock("@/lib/upstash-redis", () => ({
      getUpstashRedis: () => redis,
    }));
    const pubsub = await import("@/lib/realtime/pubsub");

    await pubsub.publishRealtimeMessage("stream:abc:typing", "chat:typing", {});
    expect(redis.expire).toHaveBeenCalledWith(
      "realtime:history:stream:abc:typing",
      10
    );
    expect(redis.ltrim).toHaveBeenCalledWith(
      "realtime:history:stream:abc:typing",
      0,
      19
    );

    await pubsub.publishRealtimeMessage("stream:abc:chat", "chat:message", {});
    expect(redis.expire).toHaveBeenLastCalledWith(
      "realtime:history:stream:abc:chat",
      3600
    );
  });
});
