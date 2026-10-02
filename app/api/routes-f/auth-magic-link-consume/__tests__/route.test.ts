import { sql } from "@vercel/postgres";
import { POST } from "../route";
import { verifyToken, signToken } from "@/lib/auth/sign-token";
import { createSession } from "@/lib/sessions/user-sessions";

jest.mock("next/server", () => {
  class FakeCookies {
    set = jest.fn();
  }
  class FakeNextResponse extends Response {
    cookies = new FakeCookies();
    static json(body: unknown, init?: ResponseInit) {
      const res = new FakeNextResponse(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      return res;
    }
  }
  return { NextResponse: FakeNextResponse };
});

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/auth/sign-token", () => ({
  verifyToken: jest.fn(),
  signToken: jest.fn(),
}));

jest.mock("@/lib/sessions/user-sessions", () => ({
  hashToken: jest.fn((t: string) => `hashed:${t}`),
  createSession: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));

const sqlMock = sql as unknown as jest.Mock;
const verifyTokenMock = verifyToken as jest.Mock;
const signTokenMock = signToken as jest.Mock;
const createSessionMock = createSession as jest.Mock;

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const WALLET = "GA123WALLET";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/routes-f/auth-magic-link-consume", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/routes-f/auth-magic-link-consume", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, SESSION_SECRET: "test-secret" };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 500 when SESSION_SECRET is not configured", async () => {
    delete process.env.SESSION_SECRET;
    const res = await POST(postRequest({ token: "abc.def" }));
    expect(res.status).toBe(500);
  });

  it("returns 400 when the token is invalid or expired", async () => {
    verifyTokenMock.mockReturnValueOnce(null);
    const res = await POST(postRequest({ token: "bad.token" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the token purpose does not match", async () => {
    verifyTokenMock.mockReturnValueOnce({
      userId: USER_ID,
      purpose: "password_reset",
      nonce: "n",
    });
    const res = await POST(postRequest({ token: "wrong.purpose" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the token has already been consumed or is unknown", async () => {
    verifyTokenMock.mockReturnValueOnce({
      userId: USER_ID,
      purpose: "magic_link",
      nonce: "n",
    });
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await POST(postRequest({ token: "replayed.token" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the token is valid but the user no longer exists", async () => {
    verifyTokenMock.mockReturnValueOnce({
      userId: USER_ID,
      purpose: "magic_link",
      nonce: "n",
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ user_id: USER_ID }] });
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await POST(postRequest({ token: "valid.token" }));
    expect(res.status).toBe(404);
  });

  it("issues a wallet_session cookie and 200 on a valid, unused token", async () => {
    verifyTokenMock.mockReturnValueOnce({
      userId: USER_ID,
      purpose: "magic_link",
      nonce: "n",
    });
    sqlMock.mockResolvedValueOnce({ rows: [{ user_id: USER_ID }] });
    sqlMock.mockResolvedValueOnce({ rows: [{ id: USER_ID, wallet: WALLET }] });
    signTokenMock.mockReturnValueOnce("signed-session-token");
    createSessionMock.mockResolvedValueOnce(undefined);

    const res: any = await POST(postRequest({ token: "valid.token" }));

    expect(res.status).toBe(200);
    expect(signTokenMock).toHaveBeenCalledWith(
      { userId: USER_ID, wallet: WALLET },
      "test-secret"
    );
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, rawToken: "signed-session-token" })
    );
    expect(res.cookies.set).toHaveBeenCalledWith(
      "wallet_session",
      "signed-session-token",
      expect.objectContaining({ httpOnly: true, path: "/" })
    );
  });

  it("returns 400 on malformed JSON body", async () => {
    const badRequest = {
      headers: new Headers(),
      json: () => Promise.reject(new Error("bad json")),
    } as any;
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    verifyTokenMock.mockReturnValueOnce({
      userId: USER_ID,
      purpose: "magic_link",
      nonce: "n",
    });
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await POST(postRequest({ token: "valid.token" }));
    expect(res.status).toBe(500);
  });
});
