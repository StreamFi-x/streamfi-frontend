/**
 * @jest-environment node
 *
 * Regression tests for the deprecated alias path
 * `/api/routes-f/cron-close-inactive-sessions`.
 *
 * Both cases here passed silently on the old implementation, which closed a
 * session whenever Mux could not be queried and never cross-checked the stream
 * it claimed to verify.
 */
import { NextRequest } from "next/server";
import { POST } from "../route";
import { sql } from "@vercel/postgres";

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => jest.fn().mockResolvedValue(false),
}));

// Both the old and the new implementation authorize via the internal secret
// here; the admin-session branch needs a request scope that unit tests don't
// have.
jest.mock("@/lib/admin-auth", () => ({
  verifyAdminSession: jest.fn().mockResolvedValue(false),
}));

const sqlMock = sql as unknown as jest.Mock;
const ORIGINAL_ENV = process.env;
const HOUR = 60 * 60 * 1000;

const OPEN_SESSION = {
  id: "session-1",
  user_id: "user-1",
  username: "streamer",
  mux_session_id: "mux-1",
  started_at: new Date(Date.now() - 3 * HOUR).toISOString(),
  user_is_live: true,
  user_mux_stream_id: "mux-1",
};

function closedAnySession(): boolean {
  return sqlMock.mock.calls.some(
    ([strings]) =>
      Array.isArray(strings) &&
      strings.join(" ").includes("UPDATE stream_sessions")
  );
}

function postRequest(): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/cron-close-inactive-sessions",
    {
      method: "POST",
      headers: { "x-internal-secret": "test-internal-secret" },
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    CRON_SECRET: "test-cron-secret",
    INTERNAL_API_SECRET: "test-internal-secret",
    MUX_TOKEN_ID: "mux-token-id",
    MUX_TOKEN_SECRET: "mux-token-secret",
  };
  delete process.env.ORPHAN_SESSION_ALERT_WEBHOOK_URL;
  delete process.env.OPS_ALERT_WEBHOOK_URL;

  sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
    if (strings.join(" ").includes("INNER JOIN users")) {
      return { rows: [OPEN_SESSION], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/routes-f/cron-close-inactive-sessions", () => {
  it("closes nothing when Mux cannot be queried", async () => {
    global.fetch = jest.fn(
      async () => new Response("boom", { status: 500 })
    ) as unknown as typeof fetch;

    const res = await POST(postRequest());
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.sessions_closed).toBe(0);
    expect(closedAnySession()).toBe(false);
  });

  it("leaves a session open while Mux still reports its stream as active", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("?")) {
        return new Response(JSON.stringify({ data: [{ id: "mux-1" }] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ data: { status: "active" } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const res = await POST(postRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessions_closed).toBe(0);
    expect(closedAnySession()).toBe(false);
  });
});
