import { sql } from "@vercel/postgres";
import { POST } from "../route";
import { sendMagicLinkEmail } from "@/utils/send-email";
import { createRateLimiter } from "@/lib/rate-limit";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/auth/sign-token", () => ({
  signToken: jest.fn(() => "signed-magic-link-token"),
}));

jest.mock("@/lib/sessions/user-sessions", () => ({
  hashToken: jest.fn((t: string) => `hashed:${t}`),
}));

jest.mock("@/utils/send-email", () => ({
  sendMagicLinkEmail: jest.fn(),
}));

// The route calls createRateLimiter(...) twice at module load time (once for
// the IP limiter, once for the account limiter) and keeps each returned
// function. To control both independently per test without a jest.mock
// factory closing over an outer-scope variable (which jest's module-factory
// hoisting forbids), createRateLimiter itself is mocked to return a fresh
// jest.fn() on every call, and the two calls' return values are captured
// after import via its `.mock.results`.
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));

const sqlMock = sql as unknown as jest.Mock;
const sendMagicLinkEmailMock = sendMagicLinkEmail as jest.Mock;
const createRateLimiterMock = createRateLimiter as jest.Mock;

// Import-time calls already happened; grab the two limiter functions the
// route is actually holding onto (order matches the route's declaration
// order: IP limiter first, then account limiter).
const ipRateLimiterMock = createRateLimiterMock.mock.results[0]
  .value as jest.Mock;
const accountRateLimiterMock = createRateLimiterMock.mock.results[1]
  .value as jest.Mock;

const USER = { id: "550e8400-e29b-41d4-a716-446655440000", email: "user@example.com" };

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/routes-f/auth-magic-link-request", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  }) as any;
}

describe("POST /api/routes-f/auth-magic-link-request", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    sqlMock.mockReset();
    sendMagicLinkEmailMock.mockReset().mockResolvedValue(undefined);
    ipRateLimiterMock.mockReset().mockResolvedValue(false);
    accountRateLimiterMock.mockReset().mockResolvedValue(false);
    process.env = { ...OLD_ENV, SESSION_SECRET: "test-secret" };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("uses two independently-controllable rate limiter functions (IP and account)", async () => {
    // clearMocks (jest.config.ts) wipes createRateLimiter's call history
    // before every test, so this asserts on behavior instead of call
    // history: the IP and account limiters must be distinct mock functions
    // that can be triggered independently (exercised by the two 429 tests
    // below), not the same limiter reused for both checks.
    expect(ipRateLimiterMock).not.toBe(accountRateLimiterMock);

    accountRateLimiterMock.mockResolvedValueOnce(true);
    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(429);
    // The IP limiter was still consulted (and passed) on this request —
    // it just wasn't the one that tripped.
    expect(ipRateLimiterMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await POST(postRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    const badRequest = {
      headers: new Headers(),
      json: () => Promise.reject(new Error("bad json")),
    } as any;
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });

  it("returns 429 when the IP rate limit is exceeded", async () => {
    ipRateLimiterMock.mockResolvedValueOnce(true);
    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(429);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-account rate limit is exceeded", async () => {
    accountRateLimiterMock.mockResolvedValueOnce(true);
    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(429);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 500 when SESSION_SECRET is not configured", async () => {
    delete process.env.SESSION_SECRET;
    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(500);
  });

  it("returns a generic 200 without sending an email when the account does not exist", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await POST(postRequest({ email: "nobody@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("verified account");
    expect(sendMagicLinkEmailMock).not.toHaveBeenCalled();
  });

  it("returns the same generic 200 when the account exists but its email is not verified", async () => {
    // The emailVerified=true filter is applied in SQL, so an unverified
    // account looks identical to a nonexistent one at this layer.
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(200);
    expect(sendMagicLinkEmailMock).not.toHaveBeenCalled();
  });

  it("issues a magic-link token and emails it when the account exists and is verified", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [USER] }); // SELECT verified user
    sqlMock.mockResolvedValueOnce({}); // invalidate old tokens
    sqlMock.mockResolvedValueOnce({}); // insert new token

    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(200);
    expect(sendMagicLinkEmailMock).toHaveBeenCalledWith(
      USER.email,
      expect.stringContaining("signed-magic-link-token")
    );
  });

  it("invalidates previously issued unused magic links before inserting a new one", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [USER] });
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({});

    await POST(postRequest({ email: USER.email }));
    // 1: SELECT user, 2: UPDATE consumed_at, 3: INSERT new token
    expect(sqlMock).toHaveBeenCalledTimes(3);
  });

  it("still returns 200 even if sending the email fails", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [USER] });
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({});
    sendMagicLinkEmailMock.mockRejectedValueOnce(new Error("smtp down"));

    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(500);
  });

  it("normalizes email case before lookup and rate-limit keying", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    await POST(postRequest({ email: "User@Example.com" }));
    expect(accountRateLimiterMock).toHaveBeenCalledWith("user@example.com");
  });
});
