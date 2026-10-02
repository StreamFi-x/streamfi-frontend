/**
 * Chat API route tests.
 * We mock @vercel/postgres and @/lib/auth/verify-session so no real DB or auth is hit.
 * We polyfill NextResponse.json because jsdom lacks Response.json.
 */

// Polyfill NextResponse.json for jsdom test environment
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

// --- Mock @vercel/postgres before importing the route ---
jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { POST, GET, DELETE } from "../route";

// Helper to build a minimal Request cast to NextRequest.
const makeRequest = (method: string, body?: object, search?: string) =>
  new Request(`http://localhost/api/streams/chat${search ?? ""}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as unknown as jest.Mock;

let consoleErrorSpy: jest.SpyInstance;

describe("POST /api/streams/chat", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-123",
      wallet: "0xABC",
      username: "Alice",
    });
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("returns 401 when session verification fails", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });
    const req = makeRequest("POST", { playbackId: "pb1", content: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when body wallet does not match verified session wallet", async () => {
    const req = makeRequest("POST", {
      wallet: "0xVICTIM_WALLET",
      playbackId: "pb1",
      content: "spoofed message",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("returns 400 when playbackId is missing", async () => {
    const req = makeRequest("POST", { wallet: "0xABC", content: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    const req = makeRequest("POST", { wallet: "0xABC", playbackId: "pb1" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when message exceeds 500 characters", async () => {
    const req = makeRequest("POST", {
      wallet: "0xABC",
      playbackId: "pb1",
      content: "a".repeat(501),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/500/);
  });

  it("returns 400 for invalid messageType", async () => {
    const req = makeRequest("POST", {
      wallet: "0xABC",
      playbackId: "pb1",
      content: "hello",
      messageType: "shout",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid message type/i);
  });

  it("returns 404 when user or stream not found", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] }); // combined query returns nothing
    const req = makeRequest("POST", {
      wallet: "0xABC",
      playbackId: "pb1",
      content: "hello",
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 409 when stream is offline", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          sender_id: "user-123",
          sender_username: "Alice",
          sender_wallet: "0xABC",
          is_live: false,
          session_id: 10,
        },
      ],
    });
    const req = makeRequest("POST", {
      wallet: "0xABC",
      playbackId: "pb1",
      content: "hello",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 404 when stream has no active session", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          sender_id: "user-123",
          sender_username: "Alice",
          sender_wallet: "0xABC",
          is_live: true,
          session_id: null,
        },
      ],
    });
    const req = makeRequest("POST", {
      wallet: "0xABC",
      playbackId: "pb1",
      content: "hello",
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("saves message and increments session count on valid request", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            sender_id: "user-123",
            sender_username: "Alice",
            sender_wallet: "0xABC",
            is_live: true,
            session_id: 10,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 99, created_at: "2024-01-01T00:00:00Z" }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE stream_sessions

    const req = makeRequest("POST", {
      wallet: "0xABC",
      playbackId: "pb1",
      content: "great stream!",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toBe("Message sent successfully");
    expect(body.chatMessage.id).toBe(99);
    expect(body.chatMessage.user.username).toBe("Alice");
    expect(body.chatMessage.user.wallet).toBe("0xABC");
  });
});

describe("GET /api/streams/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sqlMock.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  // The route caches each window for 1s per instance, so every test uses its
  // own playbackId.
  const SESSION = "5e5510a0-0000-4000-8000-000000000001";
  const msgRow = (n: number, ts: string) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    content: `m${n}`,
    message_type: "message",
    created_at: ts,
    cursor_ts: ts,
    username: "Alice",
    wallet: "0xABC",
    avatar: null,
  });
  const onlySession = async (strings: TemplateStringsArray) =>
    strings.join("").includes("stream_sessions")
      ? { rows: [{ session_id: SESSION }] }
      : { rows: [] };

  it("returns 400 when playbackId is missing", async () => {
    const req = makeRequest("GET");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns empty messages when no active stream session", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });
    const req = makeRequest("GET", undefined, "?playbackId=pb1");
  it("returns an empty page when no active session found", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] }); // session lookup
    const req = makeRequest("GET", undefined, "?playbackId=pb-empty");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("returns messages in chronological order", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: 10 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            content: "second",
            message_type: "message",
            created_at: "2024-01-01T00:01:00Z",
            username: "Bob",
            wallet: "0xDEF",
            avatar: null,
          },
          {
            id: 1,
            content: "first",
            message_type: "message",
            created_at: "2024-01-01T00:00:00Z",
            username: "Alice",
            wallet: "0xABC",
            avatar: null,
          },
  it("returns the newest page, newest first, edge-cacheable", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: SESSION }] })
      .mockResolvedValueOnce({
        rows: [
          msgRow(2, "2025-01-01T00:00:01.000000Z"),
          msgRow(1, "2025-01-01T00:00:00.000000Z"),
        ],
      });

    const res = await GET(
      makeRequest("GET", undefined, "?playbackId=pb-active")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages[0].id).toBe(1);
    expect(body.messages[1].id).toBe(2);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=1, stale-while-revalidate=1"
    );

    const body = await res.json();
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
    expect(body.items.map((m: { content: string }) => m.content)).toEqual([
      "m2",
      "m1",
    ]);
    expect(body.items[0].user.username).toBe("Alice");
    expect(body.items[0]).not.toHaveProperty("cursor_ts");
  });

  it("starts the first page from sentinels and fetches limit + 1 rows", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: SESSION }] })
      .mockResolvedValueOnce({ rows: [] });

    await GET(makeRequest("GET", undefined, "?playbackId=pb-limit&limit=10"));

    expect(sqlMock.mock.calls[1].slice(1)).toEqual([
      SESSION,
      "infinity",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      11,
    ]);
    const text = (sqlMock.mock.calls[1][0] as string[]).join("?");
    expect(text).toContain("ORDER BY cm.created_at DESC, cm.id DESC");
    expect(text).toContain("(cm.created_at, cm.id) <");
  });

  it("emits a cursor that resumes after the last row, ties included", async () => {
    const tie = "2025-01-01T00:00:00.123456Z";
    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: SESSION }] })
      .mockResolvedValueOnce({
        rows: [msgRow(3, tie), msgRow(2, tie), msgRow(1, tie)],
      });

    const first = await (
      await GET(makeRequest("GET", undefined, "?playbackId=pb-tie&limit=2"))
    ).json();
    expect(first.hasMore).toBe(true);
    expect(first.items).toHaveLength(2);

    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: SESSION }] })
      .mockResolvedValueOnce({ rows: [msgRow(1, tie)] });
    await GET(
      makeRequest(
        "GET",
        undefined,
        "?playbackId=pb-tie&limit=2&cursor=" + first.nextCursor
      )
    );

    // Full-precision timestamp plus id: the next page starts strictly after
    // the last row returned, inside the same microsecond.
    expect(sqlMock.mock.calls[3].slice(1)).toEqual([
      SESSION,
      tie,
      msgRow(2, tie).id,
      3,
    ]);
  });

  it("caps limit at 200", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: SESSION }] })
      .mockResolvedValueOnce({ rows: [] });

    await GET(makeRequest("GET", undefined, "?playbackId=pb-cap&limit=100000"));

    expect(sqlMock.mock.calls[1].slice(-1)).toEqual([201]);
  });

  it.each([
    ["a zero limit", "limit=0"],
    ["a negative limit", "limit=-5"],
    ["a non-numeric limit", "limit=abc"],
    ["a tampered cursor", "cursor=not-a-cursor"],
    ["the retired before parameter", "before=5"],
  ])("rejects %s with 400 before querying", async (_name, query) => {
    const res = await GET(
      makeRequest("GET", undefined, "?playbackId=pb-bad&" + query)
    );
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected error", async () => {
    sqlMock.mockRejectedValueOnce(new Error("DB error"));
    const req = makeRequest("GET", undefined, "?playbackId=pb-error");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("serves concurrent polls of one stream from a single load", async () => {
    sqlMock.mockImplementation(onlySession);

    const responses = await Promise.all(
      Array.from({ length: 50 }, () =>
        GET(makeRequest("GET", undefined, "?playbackId=pb-crowd&limit=200"))
      )
    );

    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("caches history pages separately from the live window", async () => {
    sqlMock.mockImplementation(onlySession);
    const cursor = Buffer.from(
      JSON.stringify({
        v: 1,
        t: "2025-01-01T00:00:00.000000Z",
        i: msgRow(1, "").id,
      })
    ).toString("base64url");

    await GET(makeRequest("GET", undefined, "?playbackId=pb-hist"));
    await GET(
      makeRequest("GET", undefined, "?playbackId=pb-hist&cursor=" + cursor)
    );

    expect(sqlMock).toHaveBeenCalledTimes(4);
  });

  it("reloads after the one-second window expires", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    sqlMock.mockImplementation(onlySession);

    await GET(makeRequest("GET", undefined, "?playbackId=pb-ttl"));
    await GET(makeRequest("GET", undefined, "?playbackId=pb-ttl"));
    expect(sqlMock).toHaveBeenCalledTimes(2);

    now.mockReturnValue(1_001_001);
    await GET(makeRequest("GET", undefined, "?playbackId=pb-ttl"));
    expect(sqlMock).toHaveBeenCalledTimes(4);
    now.mockRestore();
  });

  it("does not serve a window cached before a new message was posted", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: SESSION }] })
      .mockResolvedValueOnce({
        rows: [msgRow(1, "2025-01-01T00:00:00.000000Z")],
      });
    const before = await GET(
      makeRequest("GET", undefined, "?playbackId=pb-fresh")
    );
    expect((await before.json()).items).toHaveLength(1);

    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            sender_id: 1,
            sender_username: "Alice",
            streamer_id: 2,
            is_live: true,
            session_id: SESSION,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: msgRow(2, "").id, created_at: "2025-01-01T00:00:01Z" }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const posted = await POST(
      makeRequest("POST", {
        wallet: "0xABC",
        playbackId: "pb-fresh",
        content: "second",
      })
    );
    expect(posted.status).toBe(201);

    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: SESSION }] })
      .mockResolvedValueOnce({
        rows: [
          msgRow(2, "2025-01-01T00:00:01.000000Z"),
          msgRow(1, "2025-01-01T00:00:00.000000Z"),
        ],
      });
    const after = await GET(
      makeRequest("GET", undefined, "?playbackId=pb-fresh")
    );
    expect(
      (await after.json()).items.map((m: { content: string }) => m.content)
    ).toEqual(["m2", "m1"]);
  });
});

describe("DELETE /api/streams/chat", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-123",
      wallet: "0xABC",
      username: "Alice",
    });
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("returns 401 when unauthenticated", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });
    const req = makeRequest("DELETE", { messageId: 42 });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when messageId is missing", async () => {
    const req = makeRequest("DELETE", { moderatorWallet: "0xABC" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when client supplies a different moderatorWallet than verified session", async () => {
    const req = makeRequest("DELETE", {
      messageId: 42,
      moderatorWallet: "0xOTHER_WALLET",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("returns 404 when message is not found or already deleted", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] }); // message not found
    const req = makeRequest("DELETE", { messageId: 42 });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 when authenticated caller has no permission to delete message", async () => {
    // caller is user-123, but message author is 10 and stream owner is 20
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: 42, message_user_id: "10", stream_owner_id: "20" }],
    });

    const req = makeRequest("DELETE", { messageId: 42 });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("allows stream owner to delete any message in their stream", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "stream-owner-id",
      wallet: "0xSTREAMOWNER",
    });
  it("drops the cached window of the message's stream after a delete", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: 10 }] })
      .mockResolvedValueOnce({ rows: [] });
    await GET(makeRequest("GET", undefined, "?playbackId=pb-mod"));

    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: 20 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 42,
            message_user_id: 10,
            stream_owner_id: 20,
            mux_playback_id: "pb-mod",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    const res = await DELETE(
      makeRequest("DELETE", { messageId: 42, moderatorWallet: "0xSTREAMOWNER" })
    );
    expect(res.status).toBe(200);

    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: 10 }] })
      .mockResolvedValueOnce({ rows: [] });
    await GET(makeRequest("GET", undefined, "?playbackId=pb-mod"));
    expect(sqlMock).toHaveBeenCalledTimes(7);
  });

  it("allows stream owner to delete any message", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ id: 42, message_user_id: "random-user", stream_owner_id: "stream-owner-id" }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const req = makeRequest("DELETE", { messageId: 42 });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });

  it("allows message author to delete their own message", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "author-user-id",
      wallet: "0xAUTHOR",
    });
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ id: 42, message_user_id: "author-user-id", stream_owner_id: "stream-owner-id" }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const req = makeRequest("DELETE", { messageId: 42 });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });
});
