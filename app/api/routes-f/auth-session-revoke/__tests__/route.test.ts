/**
 * @jest-environment node
 */
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => jest.fn().mockResolvedValue(false),
}));
jest.mock("@/lib/sessions/user-sessions", () => ({
  revokeSession: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { revokeSession } from "@/lib/sessions/user-sessions";
import { DELETE } from "../route";

const verify = verifySession as unknown as jest.Mock;
const revoke = revokeSession as unknown as jest.Mock;

const VALID_SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

function deleteReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/auth-session-revoke", {
    method: "DELETE",
    body: JSON.stringify(body),
  });
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

describe("DELETE /api/routes-f/auth-session-revoke", () => {
  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await DELETE(deleteReq({ sessionId: VALID_SESSION_ID }));
    expect(res.status).toBe(401);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("returns 400 when sessionId is missing", async () => {
    const res = await DELETE(deleteReq({}));
    expect(res.status).toBe(400);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("returns 400 when sessionId is not a valid UUID", async () => {
    const res = await DELETE(deleteReq({ sessionId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("revokes the session and returns 200 on success", async () => {
    revoke.mockResolvedValue(true);
    const res = await DELETE(deleteReq({ sessionId: VALID_SESSION_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ revoked: true });
    expect(revoke).toHaveBeenCalledWith(VALID_SESSION_ID, "user-1");
  });

  it("returns 404 when the session does not exist or is already revoked", async () => {
    revoke.mockResolvedValue(false);
    const res = await DELETE(deleteReq({ sessionId: VALID_SESSION_ID }));
    expect(res.status).toBe(404);
  });

  it("returns 500 when the database call fails", async () => {
    revoke.mockRejectedValue(new Error("db down"));
    const res = await DELETE(deleteReq({ sessionId: VALID_SESSION_ID }));
    expect(res.status).toBe(500);
  });

  it("scopes revocation to the authenticated user, not an arbitrary user id in the body", async () => {
    revoke.mockResolvedValue(true);
    await DELETE(deleteReq({ sessionId: VALID_SESSION_ID, userId: "someone-else" }));
    expect(revoke).toHaveBeenCalledWith(VALID_SESSION_ID, "user-1");
  });
});
