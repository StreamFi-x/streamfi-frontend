/**
 * @jest-environment node
 *
 * #1858: the privy_session cookie used to be the bare Privy DID, so anyone who
 * knew a user's DID could forge a session. It is now an HMAC-signed token, and
 * verifySession must reject anything that isn't one.
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";
import {
  TEST_SESSION_SECRET,
  ensureTestSessionSecret,
  signedPrivySession,
} from "@/testing/privy-session";
import { signToken } from "@/lib/auth/sign-token";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));

const mockFindActiveSession = jest.fn();
jest.mock("@/lib/sessions/user-sessions", () => ({
  findActiveSession: (...args: unknown[]) => mockFindActiveSession(...args),
  touchSession: jest.fn().mockResolvedValue(undefined),
}));

import { verifySession } from "@/lib/auth/verify-session";

const DID = "did:privy:alice";
const USER_ID = "user-1";

function reqWithCookie(value: string): NextRequest {
  return new NextRequest("http://localhost/api/anything", {
    headers: { cookie: `privy_session=${value}` },
  });
}

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    privy_id: DID,
    wallet: null,
    username: "alice",
    email: "alice@example.com",
    deleted_at: null,
    ...overrides,
  };
}

async function statusOf(value: string): Promise<number> {
  const result = await verifySession(reqWithCookie(value));
  return result.ok ? 200 : result.response.status;
}

/** Number of queries that ran against the users table. */
function userQueries() {
  return mockDb.callsMatching(/FROM users/);
}

const originalSecret = process.env.SESSION_SECRET;
const originalKeyring = process.env.SESSION_KEYRING_JSON;

beforeEach(() => {
  mockDb.reset();
  mockFindActiveSession.mockReset();
  mockFindActiveSession.mockResolvedValue({
    id: "sess-1",
    last_seen_at: new Date(),
  });
  delete process.env.SESSION_KEYRING_JSON;
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  if (originalSecret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = originalSecret;
  }
  if (originalKeyring !== undefined) {
    process.env.SESSION_KEYRING_JSON = originalKeyring;
  }
});

describe("verifySession privy_session cookie (#1858)", () => {
  describe("accepts a valid signed token", () => {
    it("authenticates the user the token was issued for", async () => {
      mockDb.on(/FROM users/, { rows: [userRow()] });

      const result = await verifySession(reqWithCookie(signedPrivySession(DID)));

      expect(result).toMatchObject({
        ok: true,
        userId: USER_ID,
        privyId: DID,
        username: "alice",
      });
    });

    it("looks the user up by the DID inside the token, not by the raw cookie", async () => {
      mockDb.on(/FROM users/, { rows: [userRow()] });
      const token = signedPrivySession(DID);

      await verifySession(reqWithCookie(token));

      const [call] = userQueries();
      expect(call.values).toEqual([DID]);
      expect(call.values).not.toContain(token);
    });

    it("checks revocation against the full signed cookie value", async () => {
      mockDb.on(/FROM users/, { rows: [userRow()] });
      const token = signedPrivySession(DID);

      await verifySession(reqWithCookie(token));

      expect(mockFindActiveSession).toHaveBeenCalledWith(token);
    });
  });

  describe("rejects forged or invalid cookies before touching the database", () => {
    const rejected: Array<[string, () => string]> = [
      ["a bare did:privy value (the old forgeable format)", () => DID],
      ["an empty-looking token with no signature", () => "abc"],
      ["a token with a wrong signature", () => {
        const [payload] = signedPrivySession(DID).split(".");
        return `${payload}.${"A".repeat(43)}`;
      }],
      ["a valid signature swapped onto another user's payload", () => {
        const [, signature] = signedPrivySession(DID).split(".");
        const forgedPayload = Buffer.from(
          JSON.stringify({
            privyId: "did:privy:victim",
            iat: 0,
            exp: 9_999_999_999,
          })
        ).toString("base64url");
        return `${forgedPayload}.${signature}`;
      }],
      ["a token signed with a different secret", () =>
        signToken(
          { privyId: DID, iat: 0, exp: 9_999_999_999 },
          "some-other-secret-0123456789abcdef"
        )],
      ["an expired token", () =>
        signedPrivySession(DID, { ttlSeconds: -60 })],
      ["a token whose privyId is not a Privy DID", () =>
        signedPrivySession("did:other:alice")],
      ["a token with no privyId", () =>
        signToken({ iat: 0, exp: 9_999_999_999 }, TEST_SESSION_SECRET)],
    ];

    it.each(rejected)("%s", async (_name, makeCookie) => {
      expect(await statusOf(makeCookie())).toBe(401);
      expect(userQueries()).toHaveLength(0);
      expect(mockFindActiveSession).not.toHaveBeenCalled();
    });

    it("does not leak why the cookie was rejected", async () => {
      const result = await verifySession(reqWithCookie(DID));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(await result.response.json()).toEqual({
          error: "Invalid session",
        });
      }
    });
  });

  describe("still enforces server-side session state for valid tokens", () => {
    it("rejects a revoked or expired session row", async () => {
      mockFindActiveSession.mockResolvedValue(null);
      mockDb.on(/FROM users/, { rows: [userRow()] });

      expect(await statusOf(signedPrivySession(DID))).toBe(401);
      expect(userQueries()).toHaveLength(0);
    });

    it("rejects a validly signed token for a user that no longer exists", async () => {
      mockDb.on(/FROM users/, { rows: [] });

      expect(await statusOf(signedPrivySession(DID))).toBe(401);
    });

    it("rejects accounts pending deletion unless the route opts in", async () => {
      mockDb.on(/FROM users/, {
        rows: [userRow({ deleted_at: new Date().toISOString() })],
      });
      const token = signedPrivySession(DID);

      expect(await statusOf(token)).toBe(403);

      const allowed = await verifySession(reqWithCookie(token), {
        allowPendingDeletion: true,
      });
      expect(allowed.ok).toBe(true);
    });
  });

  describe("failure modes", () => {
    it("fails closed with a 500 when no signing key is configured", async () => {
      const token = signedPrivySession(DID);
      delete process.env.SESSION_SECRET;

      expect(await statusOf(token)).toBe(500);
      expect(userQueries()).toHaveLength(0);

      ensureTestSessionSecret();
    });

    it("accepts a token minted under an older key in the keyring", async () => {
      mockDb.on(/FROM users/, { rows: [userRow()] });
      process.env.SESSION_KEYRING_JSON = JSON.stringify({
        activeKid: "k1",
        keys: { k1: "first-signing-key-0123456789abcdef" },
      });
      const token = signedPrivySession(DID);

      process.env.SESSION_KEYRING_JSON = JSON.stringify({
        activeKid: "k2",
        keys: {
          k1: "first-signing-key-0123456789abcdef",
          k2: "second-signing-key-0123456789abcde",
        },
      });

      expect(await statusOf(token)).toBe(200);
    });

    it("rejects a token whose key was removed from the keyring", async () => {
      process.env.SESSION_KEYRING_JSON = JSON.stringify({
        activeKid: "k1",
        keys: { k1: "first-signing-key-0123456789abcdef" },
      });
      const token = signedPrivySession(DID);

      process.env.SESSION_KEYRING_JSON = JSON.stringify({
        activeKid: "k2",
        keys: { k2: "second-signing-key-0123456789abcde" },
      });

      expect(await statusOf(token)).toBe(401);
    });
  });
});
