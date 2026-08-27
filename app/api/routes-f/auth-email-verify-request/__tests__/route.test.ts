import { sql } from "@vercel/postgres";
import { POST } from "../route";
import { verifySession } from "@/lib/auth/verify-session";
import { sendEmailVerificationLink } from "@/utils/send-email";

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

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("@/lib/auth/sign-token", () => ({
  signToken: jest.fn(() => "signed-verify-token"),
}));

jest.mock("@/lib/sessions/user-sessions", () => ({
  hashToken: jest.fn((t: string) => `hashed:${t}`),
}));

jest.mock("@/utils/send-email", () => ({
  sendEmailVerificationLink: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const sendEmailVerificationLinkMock = sendEmailVerificationLink as jest.Mock;

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const NEW_EMAIL = "new-address@example.com";

function authRequest(body: unknown): Request {
  return new Request("http://localhost/api/routes-f/auth-email-verify-request", {
    method: "POST",
    headers: { cookie: "wallet_session=mock-token" },
    body: JSON.stringify(body),
  }) as any;
}

function mockAuth(userId = USER_ID) {
  verifySessionMock.mockResolvedValueOnce({ ok: true, userId });
}

describe("POST /api/routes-f/auth-email-verify-request", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, SESSION_SECRET: "test-secret" };
    sendEmailVerificationLinkMock.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns 401 when unauthenticated", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const res = await POST(authRequest({ email: NEW_EMAIL }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid email", async () => {
    mockAuth();
    const res = await POST(authRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    mockAuth();
    const badRequest = {
      json: () => Promise.reject(new Error("bad json")),
    } as any;
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });

  it("returns 500 when SESSION_SECRET is not configured", async () => {
    mockAuth();
    delete process.env.SESSION_SECRET;
    const res = await POST(authRequest({ email: NEW_EMAIL }));
    expect(res.status).toBe(500);
  });

  it("returns 409 when the email is already verified on another account", async () => {
    mockAuth();
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "other-user" }] });

    const res = await POST(authRequest({ email: NEW_EMAIL }));
    expect(res.status).toBe(409);
  });

  it("sends a verification link and returns 200 when the email is free", async () => {
    mockAuth();
    sqlMock.mockResolvedValueOnce({ rows: [] }); // no conflicting verified account
    sqlMock.mockResolvedValueOnce({}); // invalidate old tokens
    sqlMock.mockResolvedValueOnce({}); // insert new token

    const res = await POST(authRequest({ email: NEW_EMAIL }));
    expect(res.status).toBe(200);
    expect(sendEmailVerificationLinkMock).toHaveBeenCalledWith(
      NEW_EMAIL,
      expect.stringContaining("signed-verify-token")
    );
  });

  it("still returns 200 even if sending the email fails", async () => {
    mockAuth();
    sqlMock.mockResolvedValueOnce({ rows: [] });
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({});
    sendEmailVerificationLinkMock.mockRejectedValueOnce(new Error("smtp down"));

    const res = await POST(authRequest({ email: NEW_EMAIL }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    mockAuth();
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await POST(authRequest({ email: NEW_EMAIL }));
    expect(res.status).toBe(500);
  });
});
