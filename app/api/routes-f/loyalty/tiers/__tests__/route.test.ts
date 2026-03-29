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

const AUTHED_SESSION = {
  ok: true as const,
  userId: "creator-id",
  wallet: null,
  privyId: "did:privy:abc",
  username: "creator",
  email: "creator@example.com",
};

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f loyalty/tiers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(AUTHED_SESSION);
  });

  it("returns default tiers when creator has no saved config", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: "creator-id", username: "creator", tiers: null }],
      });

    const res = await GET(
      makeRequest("GET", "/api/routes-f/loyalty/tiers?creator=creator")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.tiers).toHaveLength(4);
    expect(json.tiers[0].name).toBe("Viewer");
  });

  it("enforces strictly ascending min_points on PATCH", async () => {
    const res = await PATCH(
      makeRequest("PATCH", "/api/routes-f/loyalty/tiers", {
        tiers: [
          { name: "Viewer", min_points: 0, perks: [] },
          { name: "Regular", min_points: 500, perks: ["custom_badge"] },
          { name: "VIP", min_points: 400, perks: ["priority_chat"] },
        ],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Validation failed");
  });

  it("updates tiers for authenticated creator", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            creator_id: "creator-id",
            tiers: [
              { name: "Viewer", min_points: 0, perks: [] },
              {
                name: "VIP",
                min_points: 1000,
                perks: ["custom_badge", "priority_chat"],
              },
            ],
            updated_at: "2026-03-28T00:00:00Z",
          },
        ],
      });

    const res = await PATCH(
      makeRequest("PATCH", "/api/routes-f/loyalty/tiers", {
        tiers: [
          { name: "Viewer", min_points: 0, perks: [] },
          {
            name: "VIP",
            min_points: 1000,
            perks: ["custom_badge", "priority_chat"],
          },
        ],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.creator_id).toBe("creator-id");
    expect(json.tiers).toHaveLength(2);
  });
});
