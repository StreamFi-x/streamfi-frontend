/**
 * @jest-environment node
 */
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => jest.fn().mockResolvedValue(false),
}));
jest.mock("@/lib/sessions/user-sessions", () => ({
  revokeAllOtherSessions: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { revokeAllOtherSessions } from "@/lib/sessions/user-sessions";
import { DELETE } from "../route";

const BASE = "http://localhost/api/routes-f/auth-session-revoke-all";
const verify = verifySession as unknown as jest.Mock;
const revokeAll = revokeAllOtherSessions as unknown as jest.Mock;

function req(cookies?: Record<string, string>): NextRequest {
  const request = new NextRequest(BASE, { method: "DELETE" });
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

describe("DELETE /api/routes-f/auth-session-revoke-all", () => {
  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await DELETE(req());
    expect(res.status).toBe(401);
    expect(revokeAll).not.toHaveBeenCalled();
  });

  it("returns 401 when authenticated but no session cookie is present to extract", async () => {
    const res = await DELETE(req());
    expect(res.status).toBe(401);
    expect(revokeAll).not.toHaveBeenCalled();
  });

  it("revokes all other sessions and returns the count", async () => {
    revokeAll.mockResolvedValue(3);
    const res = await DELETE(req({ privy_session: "did:privy:abc123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ revokedCount: 3 });
    expect(revokeAll).toHaveBeenCalledWith("user-1", "did:privy:abc123");
  });

  it("returns a count of 0 when there are no other sessions to revoke", async () => {
    revokeAll.mockResolvedValue(0);
    const res = await DELETE(req({ privy_session: "did:privy:abc123" }));
    const body = await res.json();
    expect(body).toEqual({ revokedCount: 0 });
  });

  it("returns 500 when the database call fails", async () => {
    revokeAll.mockRejectedValue(new Error("db down"));
    const res = await DELETE(req({ privy_session: "did:privy:abc123" }));
    expect(res.status).toBe(500);
  });
});
