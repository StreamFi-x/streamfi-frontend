jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({ createRateLimiter: () => jest.fn().mockResolvedValue(false) }));
jest.mock("@/lib/stream-password", () => ({
  ...jest.requireActual("@/lib/stream-password"),
  streamPasswordLocked: jest.fn(),
  verifyStreamPassword: jest.fn(),
  performDummyPasswordWork: jest.fn().mockResolvedValue(undefined),
  recordWrongStreamPassword: jest.fn().mockResolvedValue(undefined),
  clearStreamPasswordAttempts: jest.fn().mockResolvedValue(undefined),
  createStreamPasswordGrant: jest.fn().mockReturnValue("signed-grant"),
}));
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { streamPasswordLocked, verifyStreamPassword, performDummyPasswordWork, recordWrongStreamPassword, clearStreamPasswordAttempts } from "@/lib/stream-password";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const lockedMock = streamPasswordLocked as jest.Mock;
const verifyMock = verifyStreamPassword as jest.Mock;

function request(password: string) {
  return new NextRequest("https://streamfi.media/api/streams/password", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.10" },
    body: JSON.stringify({ username: "creator", password }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  sqlMock.mockResolvedValue({ rows: [{ creator_id: "creator-id", stream_password_hash: "scrypt$hash", stream_session_id: "live-session-id" }] });
  lockedMock.mockResolvedValue(false);
  verifyMock.mockResolvedValue(false);
});

describe("POST /api/streams/password", () => {
  it("blocks a locked IP/session pair with a generic response without comparing the password", async () => {
    lockedMock.mockResolvedValue(true);
    const response = await POST(request("guess"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unable to verify stream password" });
    expect(performDummyPasswordWork).toHaveBeenCalled();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("records a wrong attempt but leaves the route available for a legitimate retry", async () => {
    verifyMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const first = await POST(request("typo"));
    expect(first.status).toBe(401);
    expect(recordWrongStreamPassword).toHaveBeenCalledWith("live-session-id", expect.any(String));

    const retry = await POST(request("correct password"));
    expect(retry.status).toBe(200);
    expect(clearStreamPasswordAttempts).toHaveBeenCalledWith("live-session-id", expect.any(String));
    expect(retry.headers.get("set-cookie")).toContain("stream_password_access=");
  });
});