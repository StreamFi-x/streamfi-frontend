jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureRewardsSchema: jest.fn(),
  syncRewardEventsForUser: jest.fn(),
  getRewardBalance: jest.fn(),
}));

import { verifySession } from "@/lib/auth/verify-session";
import {
  ensureRewardsSchema,
  getRewardBalance,
  syncRewardEventsForUser,
} from "../_lib/db";
import { GET } from "../route";

const verifySessionMock = verifySession as jest.Mock;
const ensureRewardsSchemaMock = ensureRewardsSchema as jest.Mock;
const syncRewardEventsForUserMock = syncRewardEventsForUser as jest.Mock;
const getRewardBalanceMock = getRewardBalance as jest.Mock;

const authedSession = {
  ok: true as const,
  userId: "user-1",
  wallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  privyId: null,
  username: "viewer",
  email: "viewer@example.com",
};

function makeRequest() {
  return new Request("http://localhost/api/routes-f/rewards", {
    method: "GET",
  }) as unknown as import("next/server").NextRequest;
}

describe("GET /api/routes-f/rewards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(authedSession);
    ensureRewardsSchemaMock.mockResolvedValue(undefined);
    syncRewardEventsForUserMock.mockResolvedValue(undefined);
    getRewardBalanceMock.mockResolvedValue({
      pointsBalance: 1250,
      lifetimePoints: 1500,
      tier: "Silver",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns the synced balance and tier", async () => {
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(ensureRewardsSchemaMock).toHaveBeenCalled();
    expect(syncRewardEventsForUserMock).toHaveBeenCalledWith(
      authedSession.userId,
      authedSession.wallet
    );
    expect(json).toEqual({
      points_balance: 1250,
      lifetime_points: 1500,
      tier: "Silver",
    });
  });
});
