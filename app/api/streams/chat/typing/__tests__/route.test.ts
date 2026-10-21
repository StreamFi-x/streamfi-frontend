jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          "Content-Type": "application/json",
        },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/realtime/pubsub", () => ({
  publishRealtimeMessage: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/lib/realtime/presence", () => ({ getLivePresence: jest.fn() }));
jest.mock("@/lib/chat-spike", () => ({
  ...jest.requireActual("@/lib/chat-spike"),
  getSpikeLevelForStream: jest.fn(),
}));
const mockUserCheck = jest.fn();
const mockRoomCheck = jest.fn();
jest.mock("@/lib/rate-limit", () => ({
  createRateLimit: ({ namespace }: { namespace: string }) => ({
    check: (id: string) =>
      namespace === "chat-typing-user" ? mockUserCheck(id) : mockRoomCheck(id),
  }),
  tooManyRequests: () => new Response("{}", { status: 429 }),
}));
jest.mock("@/app/api/routes-f/stream/chat-timeout/store", () => ({
  isTimedOut: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { publishRealtimeMessage } from "@/lib/realtime/pubsub";
import { getLivePresence } from "@/lib/realtime/presence";
import { getSpikeLevelForStream } from "@/lib/chat-spike";
import { isTimedOut } from "@/app/api/routes-f/stream/chat-timeout/store";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const publishMock = publishRealtimeMessage as unknown as jest.Mock;

const makeRequest = (body: object) =>
  new Request("http://localhost/api/streams/chat/typing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

const streamRow = (overrides: object = {}) => ({
  sender_username: "Alice",
  sender_wallet: "0xABC",
  streamer_id: "streamer-1",
  is_live: true,
  chat_slow_mode_seconds: null,
  ...overrides,
});

const json = async (res: Response) => res.json();

beforeEach(() => {
  jest.clearAllMocks();
  sqlMock.mockReset();
  (verifySession as jest.Mock).mockResolvedValue({
    ok: true,
    userId: "user-1",
    wallet: "0xABC",
  });
  mockUserCheck.mockResolvedValue({ success: true });
  mockRoomCheck.mockResolvedValue({ success: true });
  (getSpikeLevelForStream as jest.Mock).mockResolvedValue("normal");
  (getLivePresence as jest.Mock).mockResolvedValue({ totalViewers: 10 });
  (isTimedOut as jest.Mock).mockReturnValue(false);
  sqlMock.mockResolvedValue({ rows: [streamRow()] });
});

describe("POST /api/streams/chat/typing", () => {
  it("publishes to the ephemeral typing channel and writes nothing to the DB", async () => {
    const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));

    expect(res.status).toBe(202);
    expect(await json(res)).toEqual({ broadcast: true });
    expect(publishMock).toHaveBeenCalledWith("stream:pb1:typing", "chat:typing", {
      state: "typing",
      username: "Alice",
      wallet: "0xABC",
    });
    // Only the stream/sender lookup (no slow-mode query: slow mode is off).
    expect(sqlMock).toHaveBeenCalledTimes(1);
    const statement = String(sqlMock.mock.calls[0][0].join(" "));
    expect(statement).not.toMatch(/INSERT|UPDATE/i);
  });

  it("returns the session's response when unauthenticated", async () => {
    (verifySession as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response("{}", { status: 401 }),
    });
    const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
    expect(res.status).toBe(401);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("validates playbackId and state", async () => {
    expect((await POST(makeRequest({ state: "typing" }))).status).toBe(400);
    expect(
      (await POST(makeRequest({ playbackId: "pb1", state: "dancing" }))).status
    ).toBe(400);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("rate-limits per user", async () => {
    mockUserCheck.mockResolvedValue({ success: false, retryAfterSeconds: 3 });
    const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
    expect(res.status).toBe(429);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("404s for an unknown stream", async () => {
    sqlMock.mockResolvedValue({ rows: [] });
    const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
    expect(res.status).toBe(404);
  });

  it("does not broadcast for an offline stream", async () => {
    sqlMock.mockResolvedValue({ rows: [streamRow({ is_live: false })] });
    const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
    expect(res.status).toBe(202);
    expect(await json(res)).toEqual({ broadcast: false, reason: "offline" });
    expect(publishMock).not.toHaveBeenCalled();
  });

  describe("moderation", () => {
    it("suppresses a timed-out user (checked by streamer id and playback id)", async () => {
      (isTimedOut as jest.Mock).mockImplementation(
        (streamId: string) => streamId === "pb1"
      );
      const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(res)).toEqual({ broadcast: false, reason: "timed-out" });
      expect(publishMock).not.toHaveBeenCalled();
    });

    it("suppresses a user inside the slow-mode cooldown", async () => {
      sqlMock
        .mockResolvedValueOnce({ rows: [streamRow({ chat_slow_mode_seconds: "30" })] })
        .mockResolvedValueOnce({ rows: [{ elapsed_ms: 5000 }] });
      const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(res)).toEqual({ broadcast: false, reason: "slow-mode" });
      expect(publishMock).not.toHaveBeenCalled();
    });

    it("allows a user whose slow-mode cooldown has passed", async () => {
      sqlMock
        .mockResolvedValueOnce({ rows: [streamRow({ chat_slow_mode_seconds: "30" })] })
        .mockResolvedValueOnce({ rows: [{ elapsed_ms: 31000 }] });
      const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(res)).toEqual({ broadcast: true });
    });

    it("allows a user with no previous message under slow mode", async () => {
      sqlMock
        .mockResolvedValueOnce({ rows: [streamRow({ chat_slow_mode_seconds: "30" })] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(res)).toEqual({ broadcast: true });
    });

    it("still publishes 'stopped' for a restricted user, without a slow-mode query", async () => {
      (isTimedOut as jest.Mock).mockReturnValue(true);
      sqlMock.mockResolvedValue({
        rows: [streamRow({ chat_slow_mode_seconds: "30" })],
      });
      const res = await POST(makeRequest({ playbackId: "pb1", state: "stopped" }));
      expect(await json(res)).toEqual({ broadcast: true });
      expect(sqlMock).toHaveBeenCalledTimes(1);
      expect(publishMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("high viewer counts and load", () => {
    it("sheds typing at critical chat load", async () => {
      (getSpikeLevelForStream as jest.Mock).mockResolvedValue("critical");
      const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(res)).toEqual({ broadcast: false, reason: "load-shed" });
      expect(publishMock).not.toHaveBeenCalled();
    });

    it("applies the room budget in the sampled tier", async () => {
      (getLivePresence as jest.Mock).mockResolvedValue({ totalViewers: 500 });
      mockRoomCheck.mockResolvedValue({ success: false });
      const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(res)).toEqual({ broadcast: false, reason: "room-sampled" });

      mockRoomCheck.mockResolvedValue({ success: true });
      const ok = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(ok)).toEqual({ broadcast: true });
    });

    it("ignores an exhausted room budget in small rooms", async () => {
      mockRoomCheck.mockResolvedValue({ success: false });
      const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(res)).toEqual({ broadcast: true });
    });

    it("disables typing above the viewer cutoff", async () => {
      (getLivePresence as jest.Mock).mockResolvedValue({ totalViewers: 5000 });
      const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(res)).toEqual({ broadcast: false, reason: "viewer-cutoff" });
      expect(publishMock).not.toHaveBeenCalled();
    });

    it("treats an unavailable presence lookup as a small room", async () => {
      (getLivePresence as jest.Mock).mockRejectedValue(new Error("redis down"));
      const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
      expect(await json(res)).toEqual({ broadcast: true });
    });
  });

  it("returns 500 when publishing fails", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    publishMock.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(makeRequest({ playbackId: "pb1", state: "typing" }));
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
