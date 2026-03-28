jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureAlertSchema: jest.fn().mockResolvedValue(undefined),
  ALERT_TYPES: ["tip", "subscription", "gift", "raid", "follow"],
  DEFAULT_ALERT_CONFIG: {
    enabled_types: ["tip", "subscription", "gift", "raid", "follow"],
    display_duration_ms: 5000,
    sound_enabled: true,
    custom_message_template: null,
  },
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, PATCH } from "../route";
import { POST } from "../test/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const AUTHED_SESSION = {
  ok: true as const,
  userId: "user-id",
  wallet: null,
  privyId: "did:privy:abc",
  username: "alice",
  email: "alice@example.com",
};

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f alerts", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(AUTHED_SESSION);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("returns the default alert config when none exists", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(makeRequest("GET", "/api/routes-f/alerts"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.display_duration_ms).toBe(5000);
    expect(json.enabled_types).toContain("tip");
  });

  it("rejects an out-of-range display duration", async () => {
    const res = await PATCH(
      makeRequest("PATCH", "/api/routes-f/alerts", {
        display_duration_ms: 20000,
      })
    );

    expect(res.status).toBe(400);
  });

  it("updates and returns the alert config", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          enabled_types: ["tip", "follow"],
          display_duration_ms: 4000,
          sound_enabled: false,
          custom_message_template: "{viewer} triggered {type}",
        },
      ],
    });

    const res = await PATCH(
      makeRequest("PATCH", "/api/routes-f/alerts", {
        enabled_types: ["tip", "follow"],
        display_duration_ms: 4000,
        sound_enabled: false,
        custom_message_template: "{viewer} triggered {type}",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.display_duration_ms).toBe(4000);
    expect(json.sound_enabled).toBe(false);
  });

  it("stores a test alert event for polling", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "alert-event-1",
          alert_type: "raid",
          message: "Test viewer triggered a test raid",
          payload: { actor_username: "Test viewer" },
          is_test: true,
          created_at: "2026-03-27T00:00:00Z",
        },
      ],
    });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/alerts/test", {
        type: "raid",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.delivery).toBe("stored_for_polling");
    expect(json.event.alert_type).toBe("raid");
  });
});
