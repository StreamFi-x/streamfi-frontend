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

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, PATCH } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const authedSession = {
  ok: true as const,
  userId: "user-123",
  wallet: null,
  privyId: "did:privy:abc",
  username: "creator",
  email: "creator@example.com",
};

const makeRequest = (method: string, body?: object) =>
  new Request("http://localhost/api/routes-f/notifications/settings", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

describe("routes-f notification settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(authedSession);
  });

  it("returns default preferences when no settings row exists", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences.email.new_follower).toBe(true);
    expect(body.preferences.push.stream_live).toBe(true);
    expect(body.preferences.in_app.tip_received).toBe(true);
  });

  it("applies a partial patch and preserves unspecified values", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            preferences: {
              email: {
                new_follower: true,
                stream_live: true,
                tip_received: true,
              },
              push: {
                new_follower: true,
                stream_live: true,
                tip_received: true,
              },
              in_app: {
                new_follower: true,
                stream_live: false,
                tip_received: true,
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await PATCH(
      makeRequest("PATCH", {
        email: { tip_received: false },
        in_app: { new_follower: false },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences.email.tip_received).toBe(false);
    expect(body.preferences.email.new_follower).toBe(true);
    expect(body.preferences.in_app.new_follower).toBe(false);
    expect(body.preferences.push.tip_received).toBe(true);
  });

  it("rejects unknown top-level keys", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await PATCH(
      makeRequest("PATCH", {
        sms: { new_follower: true },
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringMatching(/unknown notification channel/i),
    });
  });

  it("rejects unknown nested keys", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await PATCH(
      makeRequest("PATCH", {
        email: { marketing: true },
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringMatching(/unknown preference key/i),
    });
  });
});
