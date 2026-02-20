/**
 * Chat API route tests.
 * We mock @vercel/postgres so no real DB is hit.
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

import { sql } from "@vercel/postgres";
import { POST, GET, DELETE } from "../route";

// Helper to build a minimal Request
const makeRequest = (method: string, body?: object, search?: string) =>
  new Request(`http://localhost/api/streams/chat${search ?? ""}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

const sqlMock = sql as unknown as jest.Mock;

describe("POST /api/streams/chat", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when wallet is missing", async () => {
    const req = makeRequest("POST", { playbackId: "pb1", content: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/wallet/i);
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
          sender_id: 1,
          sender_username: "Alice",
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
          sender_id: 1,
          sender_username: "Alice",
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

  it("returns 201 and chatMessage on success", async () => {
    sqlMock
      .mockResolvedValueOnce({
        // combined lookup
        rows: [
          {
            sender_id: 1,
            sender_username: "Alice",
            is_live: true,
            session_id: 10,
          },
        ],
      })
      .mockResolvedValueOnce({
        // INSERT
        rows: [{ id: 99, created_at: "2025-01-01T00:00:00Z" }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE total_messages

    const req = makeRequest("POST", {
      wallet: "0xABC",
      playbackId: "pb1",
      content: "hello",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.chatMessage.id).toBe(99);
    expect(body.chatMessage.content).toBe("hello");
    expect(body.chatMessage.user.username).toBe("Alice");
    expect(body.chatMessage.user.wallet).toBe("0xABC");
  });

  it("returns 500 on unexpected database error", async () => {
    sqlMock.mockRejectedValueOnce(new Error("DB down"));
    const req = makeRequest("POST", {
      wallet: "0xABC",
      playbackId: "pb1",
      content: "hello",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe("GET /api/streams/chat", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when playbackId is missing", async () => {
    const req = makeRequest("GET", undefined, "");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns empty messages when no active session found", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] }); // session lookup
    const req = makeRequest("GET", undefined, "?playbackId=pb1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toEqual([]);
  });

  it("returns messages for an active session", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: 10 }] }) // session lookup
      .mockResolvedValueOnce({
        // messages query
        rows: [
          {
            id: 1,
            content: "hello",
            message_type: "message",
            created_at: "2025-01-01T00:00:00Z",
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
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe("hello");
    expect(body.messages[0].user.username).toBe("Alice");
  });

  it("respects the limit query param", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ session_id: 10 }] })
      .mockResolvedValueOnce({ rows: [] });

    const req = makeRequest("GET", undefined, "?playbackId=pb1&limit=10");
    await GET(req);

    // Tagged template literals are called as sql(strings, ...values).
    // The interpolated values are the 2nd+ arguments in the call array,
    // not embedded in the template strings array. Check that 10 appears
    // as one of the interpolated values in the messages query call.
    const secondCallArgs = sqlMock.mock.calls[1]; // [templateStrings, val1, val2, ...]
    const interpolatedValues = secondCallArgs.slice(1);
    expect(interpolatedValues).toContain(10);
  });

  it("returns 500 on unexpected error", async () => {
    sqlMock.mockRejectedValueOnce(new Error("DB error"));
    const req = makeRequest("GET", undefined, "?playbackId=pb1");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/streams/chat", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when messageId is missing", async () => {
    const req = makeRequest("DELETE", { moderatorWallet: "0xABC" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when moderatorWallet is missing", async () => {
    const req = makeRequest("DELETE", { messageId: 42 });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when moderator is not found", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] }); // moderator lookup
    const req = makeRequest("DELETE", {
      messageId: 42,
      moderatorWallet: "0xABC",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("returns 404 when message is not found or already deleted", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // moderator found
      .mockResolvedValueOnce({ rows: [] }); // message not found

    const req = makeRequest("DELETE", {
      messageId: 42,
      moderatorWallet: "0xABC",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user has no permission to delete", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // moderator (id=99)
      .mockResolvedValueOnce({
        rows: [{ id: 42, message_user_id: 10, stream_owner_id: 20 }], // neither 10 nor 20 = 99
      });

    const req = makeRequest("DELETE", {
      messageId: 42,
      moderatorWallet: "0xABC",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("allows stream owner to delete any message", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: 20 }] }) // moderator = stream owner
      .mockResolvedValueOnce({
        rows: [{ id: 42, message_user_id: 10, stream_owner_id: 20 }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const req = makeRequest("DELETE", {
      messageId: 42,
      moderatorWallet: "0xSTREAMOWNER",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });

  it("allows message author to delete their own message", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // moderator = message author
      .mockResolvedValueOnce({
        rows: [{ id: 42, message_user_id: 10, stream_owner_id: 20 }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const req = makeRequest("DELETE", {
      messageId: 42,
      moderatorWallet: "0xAUTHOR",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });

  it("returns 500 on unexpected error", async () => {
    sqlMock.mockRejectedValueOnce(new Error("DB error"));
    const req = makeRequest("DELETE", {
      messageId: 42,
      moderatorWallet: "0xABC",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(500);
  });
});
