/**
 * @jest-environment node
 *
 * POST /api/users/register: method restriction (#1863) and welcome-email
 * failure isolation (#1862).
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => async () => false,
}));
jest.mock("@/utils/validators", () => ({
  validateEmail: () => true,
  checkExistingTableDetail: jest.fn(async () => false),
}));
jest.mock("@/utils/send-email", () => ({
  sendWelcomeRegistrationEmail: jest.fn(async () => true),
}));
jest.mock("@/lib/profile-icons", () => ({
  getRandomProfileIcon: () => "/icons/1.svg",
}));
jest.mock("@/lib/mux/server", () => ({
  createMuxStream: jest.fn(async () => ({
    id: "ls-1",
    playbackId: "pb-1",
    streamKey: "key-1",
    rtmpUrl: "rtmp://x",
  })),
}));
jest.mock("@/lib/cache/invalidation", () => ({
  invalidateUserCaches: jest.fn(),
}));

import { sendWelcomeRegistrationEmail } from "@/utils/send-email";
import * as route from "@/app/api/users/register/route";

const WALLET = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

function postRequest() {
  return new NextRequest("http://localhost/api/users/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "a@b.io",
      username: "alice",
      wallet: WALLET,
    }),
  });
}

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  process.env.MUX_TOKEN_ID = "id";
  process.env.MUX_TOKEN_SECRET = "secret";
  mockDb.on(/SELECT LOWER\(username\) AS username/, { rows: [] });
  mockDb.on(/INSERT INTO users/, { rowCount: 1 });
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("method handling (#1863)", () => {
  it("exports only POST as the mutating handler", () => {
    expect(route.POST).toBeDefined();
  });

  it("GET returns 405 with an Allow: POST header and never touches the DB", async () => {
    const res = await route.GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
    expect(mockDb.calls).toHaveLength(0);
    expect(sendWelcomeRegistrationEmail).not.toHaveBeenCalled();
  });
});

describe("welcome email failure (#1862)", () => {
  it("returns success when the welcome email rejects after the user is inserted", async () => {
    (sendWelcomeRegistrationEmail as jest.Mock).mockRejectedValueOnce(
      new Error("SMTP down")
    );
    const res = await route.POST(postRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("User registration success");
    expect(mockDb.callsMatching(/INSERT INTO users/)).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(
      "[register] Failed to send welcome email:",
      expect.any(Error)
    );
  });

  it("still returns success when the email sends normally", async () => {
    const res = await route.POST(postRequest());
    expect(res.status).toBe(200);
    expect(sendWelcomeRegistrationEmail).toHaveBeenCalledWith(
      "a@b.io",
      "alice"
    );
  });
});

describe("username normalization and homoglyph protection (#1725)", () => {
  // U+0430 CYRILLIC SMALL LETTER A renders identically to Latin "a".
  const CYRILLIC_A = "\u0430";

  function registerAs(username: string) {
    return route.POST(
      new NextRequest("http://localhost/api/users/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.io", username, wallet: WALLET }),
      })
    );
  }

  it("rejects a homoglyph of an already registered username", async () => {
    mockDb.reset();
    mockDb.on(/SELECT LOWER\(username\) AS username/, {
      rows: [{ username: "alice" }],
    });
    mockDb.on(/INSERT INTO users/, { rowCount: 1 });

    const res = await registerAs(`${CYRILLIC_A}\u04cf\u0456\u0441\u0435`);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("USERNAME_LOOKALIKE");
    expect(mockDb.callsMatching(/INSERT INTO users/)).toHaveLength(0);
  });

  it("rejects mixed-script names before touching the DB", async () => {
    const res = await registerAs(`${CYRILLIC_A}lice1`);

    expect(res.status).toBe(400);
    expect(mockDb.callsMatching(/FROM users/)).toHaveLength(0);
  });

  it("rejects an exact duplicate after normalization", async () => {
    mockDb.reset();
    mockDb.on(/SELECT LOWER\(username\) AS username/, {
      rows: [{ username: "alice" }],
    });

    const res = await registerAs("  ALICE ");

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Username already exist");
  });

  it("stores the skeleton alongside the normalized username", async () => {
    const res = await registerAs("Alice");

    expect(res.status).toBe(200);
    const [insert] = mockDb.callsMatching(/INSERT INTO users/);
    expect(JSON.stringify(insert)).toContain("alice");
    expect(JSON.stringify(insert)).toContain("username_skeleton");
  });

  it("rejects usernames with invisible characters", async () => {
    const res = await registerAs("ali\u200bce");

    expect(res.status).toBe(400);
    expect(mockDb.callsMatching(/INSERT INTO users/)).toHaveLength(0);
  });
});
