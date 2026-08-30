import { sql } from "@vercel/postgres";
import { POST } from "../route";
import { verifyToken } from "@/lib/auth/sign-token";

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
  verifyToken: jest.fn(),
}));

jest.mock("@/lib/sessions/user-sessions", () => ({
  hashToken: jest.fn((t: string) => `hashed:${t}`),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));

const sqlMock = sql as unknown as jest.Mock;
const verifyTokenMock = verifyToken as jest.Mock;

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_PASSWORD = "Sup3rSecret";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/routes-f/auth-password-reset-confirm", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/routes-f/auth-password-reset-confirm", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, SESSION_SECRET: "test-secret" };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns 400 when the password fails the strength policy", async () => {
    const res = await POST(postRequest({ token: "t", password: "weak" }));
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
    const res = await POST(postRequest({ token: "t", password: VALID_PASSWORD }));
    expect(res.status).toBe(500);
  });

  it("returns 400 when the token signature is invalid or expired", async () => {
    verifyTokenMock.mockReturnValueOnce(null);
    const res = await POST(postRequest({ token: "bad", password: VALID_PASSWORD }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the token purpose does not match", async () => {
    verifyTokenMock.mockReturnValueOnce({
      userId: USER_ID,
      purpose: "email_verify",
      nonce: "n",
    });
    const res = await POST(postRequest({ token: "t", password: VALID_PASSWORD }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the token has already been consumed or is unknown (replay)", async () => {
    verifyTokenMock.mockReturnValueOnce({
      userId: USER_ID,
      purpose: "password_reset",
      nonce: "n",
    });
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await POST(postRequest({ token: "replayed", password: VALID_PASSWORD }));
    expect(res.status).toBe(400);
  });

  it("resets the password and revokes sessions on a valid, unused token", async () => {
    verifyTokenMock.mockReturnValueOnce({
      userId: USER_ID,
      purpose: "password_reset",
      nonce: "n",
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ user_id: USER_ID }] }); // consume token
    sqlMock.mockReturnValueOnce({ catch: () => Promise.resolve() }); // update password_hash
    sqlMock.mockReturnValueOnce({ catch: () => Promise.resolve() }); // revoke sessions

    const res = await POST(postRequest({ token: "valid", password: VALID_PASSWORD }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    verifyTokenMock.mockReturnValueOnce({
      userId: USER_ID,
      purpose: "password_reset",
      nonce: "n",
    });
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await POST(postRequest({ token: "valid", password: VALID_PASSWORD }));
    expect(res.status).toBe(500);
  });
});
