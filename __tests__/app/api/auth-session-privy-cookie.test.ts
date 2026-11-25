/**
 * @jest-environment node
 *
 * #1858: POST /api/auth/session must issue a signed privy_session cookie, not
 * the bare Privy DID, and the same signed value must be what user_sessions
 * records so revocation lookups match the cookie.
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";
import { TEST_SESSION_SECRET } from "@/testing/privy-session";
import { verifyToken } from "@/lib/auth/sign-token";
import { currentKeyring } from "@/lib/security/keyring";

const DID = "did:privy:alice";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));

jest.mock("@privy-io/server-auth", () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    verifyAuthToken: jest.fn().mockResolvedValue({ userId: "did:privy:alice" }),
    getUser: jest.fn().mockResolvedValue({
      linkedAccounts: [
        { type: "google_oauth", email: "alice@example.com", name: "Alice" },
      ],
    }),
  })),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => jest.fn().mockResolvedValue(false),
}));
jest.mock("@/lib/profile-icons", () => ({
  getRandomProfileIcon: () => "icon.png",
}));
jest.mock("@/lib/security/login-anomaly", () => ({
  recordLoginAndCheckTravel: jest.fn().mockResolvedValue(undefined),
}));
const mockCreateSession = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/sessions/user-sessions", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}));

import { POST, DELETE } from "@/app/api/auth/session/route";

function loginRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/session", {
    method: "POST",
    headers: { authorization: "Bearer privy-jwt", "x-real-ip": "203.0.113.5" },
  });
}

function cookieValue(setCookie: string): string {
  return setCookie.split(";")[0].replace("privy_session=", "");
}

const originalSecret = process.env.SESSION_SECRET;
const originalKeyring = process.env.SESSION_KEYRING_JSON;
const originalAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const originalPrivySecret = process.env.PRIVY_APP_SECRET;

beforeEach(() => {
  mockDb.reset();
  mockCreateSession.mockClear();
  delete process.env.SESSION_KEYRING_JSON;
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = "app-id";
  process.env.PRIVY_APP_SECRET = "privy-secret";
  mockDb.on(/SELECT id FROM users/, { rows: [] });
  mockDb.on(/INSERT INTO users/, {});
  mockDb.on(/SELECT id, privy_id, username/, {
    rows: [
      {
        id: "user-1",
        privy_id: DID,
        username: "alice",
        email: "alice@example.com",
        avatar: "icon.png",
        wallet: null,
      },
    ],
  });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };
  restore("SESSION_SECRET", originalSecret);
  restore("SESSION_KEYRING_JSON", originalKeyring);
  restore("NEXT_PUBLIC_PRIVY_APP_ID", originalAppId);
  restore("PRIVY_APP_SECRET", originalPrivySecret);
});

describe("POST /api/auth/session (#1858)", () => {
  it("sets a signed privy_session cookie, not the bare DID", async () => {
    const res = await POST(loginRequest());
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    const value = cookieValue(setCookie);

    expect(res.status).toBe(200);
    expect(value).not.toBe(DID);
    expect(value).not.toContain("did:privy:");
    expect(verifyToken<{ privyId: string }>(value, currentKeyring())).toMatchObject(
      { privyId: DID }
    );
  });

  it("gives the token a 24 hour lifetime matching the cookie Max-Age", async () => {
    const res = await POST(loginRequest());
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    const payload = verifyToken<{ iat: number; exp: number }>(
      cookieValue(setCookie),
      currentKeyring()
    );

    expect(setCookie).toContain("Max-Age=86400");
    expect(payload).not.toBeNull();
    expect(payload!.exp - payload!.iat).toBe(86400);
  });

  it("keeps the cookie HttpOnly and SameSite=Strict", async () => {
    const res = await POST(loginRequest());
    const setCookie = res.headers.get("Set-Cookie") ?? "";

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
  });

  it("records the same signed value in user_sessions so revocation matches", async () => {
    const res = await POST(loginRequest());
    const value = cookieValue(res.headers.get("Set-Cookie") ?? "");

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockCreateSession.mock.calls[0][0]).toMatchObject({
      userId: "user-1",
      rawToken: value,
    });
  });

  it("does not put the signed token or DID secret material in the JSON body", async () => {
    const res = await POST(loginRequest());
    const body = await res.json();
    const value = cookieValue(res.headers.get("Set-Cookie") ?? "");

    expect(JSON.stringify(body)).not.toContain(value);
  });

  it("fails closed with a 500 and no cookie when no signing key is configured", async () => {
    delete process.env.SESSION_SECRET;

    const res = await POST(loginRequest());

    expect(res.status).toBe(500);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("rejects a request with no bearer token before issuing anything", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/session", { method: "POST" })
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });
});

describe("DELETE /api/auth/session", () => {
  it("expires the privy_session cookie", async () => {
    const res = await DELETE();

    expect(res.headers.get("Set-Cookie")).toContain("privy_session=;");
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
