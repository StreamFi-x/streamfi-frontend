import { sql } from "@vercel/postgres";
import { POST } from "../route";
import { sendPasswordResetEmail } from "@/utils/send-email";

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
  signToken: jest.fn(() => "signed-reset-token"),
}));

jest.mock("@/lib/sessions/user-sessions", () => ({
  hashToken: jest.fn((t: string) => `hashed:${t}`),
}));

jest.mock("@/utils/send-email", () => ({
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));

const sqlMock = sql as unknown as jest.Mock;
const sendPasswordResetEmailMock = sendPasswordResetEmail as jest.Mock;

const USER = { id: "550e8400-e29b-41d4-a716-446655440000", email: "user@example.com" };

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/routes-f/auth-password-reset-request", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/routes-f/auth-password-reset-request", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, SESSION_SECRET: "test-secret" };
    sendPasswordResetEmailMock.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = OLD_ENV;
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

  it("returns 500 when SESSION_SECRET is not configured", async () => {
    delete process.env.SESSION_SECRET;
    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(500);
  });

  it("returns a generic 200 without sending an email when the account does not exist", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await POST(postRequest({ email: "nobody@example.com" }));
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("issues a reset token and emails it when the account exists", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [USER] }); // SELECT user
    sqlMock.mockResolvedValueOnce({}); // invalidate old tokens
    sqlMock.mockResolvedValueOnce({}); // insert new token

    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
      USER.email,
      expect.stringContaining("signed-reset-token")
    );
  });

  it("still returns 200 even if sending the email fails", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [USER] });
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({});
    sendPasswordResetEmailMock.mockRejectedValueOnce(new Error("smtp down"));

    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await POST(postRequest({ email: USER.email }));
    expect(res.status).toBe(500);
  });
});
