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
        headers: { "Content-Type": "application/json" },
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
    jest.clearAllMocks();
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
  });

  it("returns 400 when playbackId is missing", async () => {
    const req = makeRequest("GET");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns empty messages when no active stream session", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });
    const req = makeRequest("GET", undefined, "?playbackId=pb1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toEqual([]);
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
        ],
      });

    const req = makeRequest("GET", undefined, "?playbackId=pb1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages[0].id).toBe(1);
    expect(body.messages[1].id).toBe(2);
  });
});

describe("DELETE /api/streams/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
