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

jest.mock("../../_lib/db", () => ({
  ensureRewardsSchema: jest.fn(),
  syncRewardEventsForUser: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureRewardsSchema, syncRewardEventsForUser } from "../../_lib/db";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const ensureRewardsSchemaMock = ensureRewardsSchema as jest.Mock;
const syncRewardEventsForUserMock = syncRewardEventsForUser as jest.Mock;

const authedSession = {
  ok: true as const,
  userId: "user-1",
  wallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  privyId: null,
  username: "viewer",
  email: "viewer@example.com",
};

function makeRequest(query = "") {
  return new Request(`http://localhost/api/routes-f/rewards/history${query}`, {
    method: "GET",
  }) as unknown as import("next/server").NextRequest;
}

describe("GET /api/routes-f/rewards/history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(authedSession);
    ensureRewardsSchemaMock.mockResolvedValue(undefined);
    syncRewardEventsForUserMock.mockResolvedValue(undefined);
  });

  it("returns reward events in descending order", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "evt-2",
          event_type: "redeem",
          points: -250,
          metadata: { reward_id: "featured-chat-highlight", quantity: 1 },
          created_at: "2026-03-28T10:00:00.000Z",
        },
        {
          id: "evt-1",
          event_type: "watch",
          points: 60,
          metadata: { stream_session_id: "stream-1" },
          created_at: "2026-03-28T09:00:00.000Z",
        },
      ],
    });

    const res = await GET(makeRequest("?limit=2"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(syncRewardEventsForUserMock).toHaveBeenCalledWith(
      authedSession.userId,
      authedSession.wallet
    );
    expect(json).toEqual({
      events: [
        {
          id: "evt-2",
          event_type: "redeem",
          points: -250,
          metadata: { reward_id: "featured-chat-highlight", quantity: 1 },
          created_at: "2026-03-28T10:00:00.000Z",
        },
        {
          id: "evt-1",
          event_type: "watch",
          points: 60,
          metadata: { stream_session_id: "stream-1" },
          created_at: "2026-03-28T09:00:00.000Z",
        },
      ],
      next_cursor: "evt-1",
    });
  });

  it("returns 400 for invalid pagination params", async () => {
    const res = await GET(makeRequest("?limit=0"));
    expect(res.status).toBe(400);
  });
});
