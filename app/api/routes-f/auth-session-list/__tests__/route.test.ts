jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => jest.fn().mockResolvedValue(false),
}));
jest.mock("@/lib/sessions/user-sessions", () => ({
  listActiveSessions: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { listActiveSessions } from "@/lib/sessions/user-sessions";
import { GET } from "../route";

const BASE = "http://localhost/api/routes-f/auth-session-list";
const verify = verifySession as unknown as jest.Mock;
const listSessions = listActiveSessions as unknown as jest.Mock;

function req(cookies?: Record<string, string>): NextRequest {
  const request = new NextRequest(BASE);
  if (cookies) {
    for (const [key, value] of Object.entries(cookies)) {
      request.cookies.set(key, value);
    }
  }
  return request;
}

beforeEach(() => {
  jest.clearAllMocks();
  verify.mockResolvedValue({
    ok: true,
    userId: "user-1",
    wallet: null,
    privyId: null,
    username: null,
    email: null,
  });
});

describe("GET /api/routes-f/auth-session-list", () => {
  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("returns 401 when authenticated but no session cookie is present to extract", async () => {
    // verifySession succeeded (e.g. some future auth path without a cookie)
    // but extractRawToken finds nothing — guard should still fire.
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("returns sessions with ip_hash instead of ip_address, never the raw IP", async () => {
    listSessions.mockResolvedValue([
      {
        id: "sess-1",
        device_hint: "Chrome on macOS",
        ip_address: "3f9c2b00e1", // pre-hashed by the mocked lib layer
        last_seen_at: "2026-03-26T12:00:00.000Z",
        created_at: "2026-03-25T08:00:00.000Z",
        is_current: true,
      },
    ]);

    const res = await GET(req({ privy_session: "did:privy:abc123" }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]).toEqual({
      id: "sess-1",
      device_hint: "Chrome on macOS",
      ip_hash: "3f9c2b00e1",
      last_seen_at: "2026-03-26T12:00:00.000Z",
      created_at: "2026-03-25T08:00:00.000Z",
      is_current: true,
    });
    expect(body.sessions[0]).not.toHaveProperty("ip_address");
  });

  it("requests hashed (not masked) IPs from listActiveSessions", async () => {
    listSessions.mockResolvedValue([]);
    await GET(req({ privy_session: "did:privy:abc123" }));
    expect(listSessions).toHaveBeenCalledWith(
      "user-1",
      "did:privy:abc123",
      "hash"
    );
  });

  it("returns an empty list when the user has no active sessions", async () => {
    listSessions.mockResolvedValue([]);
    const res = await GET(req({ privy_session: "did:privy:abc123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toEqual([]);
  });

  it("returns null ip_hash for a session with no recorded IP", async () => {
    listSessions.mockResolvedValue([
      {
        id: "sess-2",
        device_hint: "Unknown device",
        ip_address: null,
        last_seen_at: "2026-03-26T12:00:00.000Z",
        created_at: "2026-03-25T08:00:00.000Z",
        is_current: false,
      },
    ]);
    const res = await GET(req({ privy_session: "did:privy:abc123" }));
    const body = await res.json();
    expect(body.sessions[0].ip_hash).toBeNull();
  });

  it("returns 500 when the database lookup fails", async () => {
    listSessions.mockRejectedValue(new Error("db down"));
    const res = await GET(req({ privy_session: "did:privy:abc123" }));
    expect(res.status).toBe(500);
  });
});
