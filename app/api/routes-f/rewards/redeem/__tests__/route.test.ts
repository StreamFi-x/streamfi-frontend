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

jest.mock("../../_lib/db", () => ({
  ensureRewardsSchema: jest.fn(),
  ensureRewardBalanceRow: jest.fn(),
  syncRewardEventsForUser: jest.fn(),
  getRewardBalance: jest.fn(),
  withRewardsTransaction: jest.fn(),
  getRewardDefinition: jest.fn(),
}));

import { verifySession } from "@/lib/auth/verify-session";
import {
  ensureRewardsSchema,
  getRewardBalance,
  getRewardDefinition,
  withRewardsTransaction,
} from "../../_lib/db";
import { POST } from "../route";

const verifySessionMock = verifySession as jest.Mock;
const ensureRewardsSchemaMock = ensureRewardsSchema as jest.Mock;
const getRewardBalanceMock = getRewardBalance as jest.Mock;
const withRewardsTransactionMock = withRewardsTransaction as jest.Mock;
const getRewardDefinitionMock = getRewardDefinition as jest.Mock;

const authedSession = {
  ok: true as const,
  userId: "user-1",
  wallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  privyId: null,
  username: "viewer",
  email: "viewer@example.com",
};

function makeRequest(body: object) {
  return new Request("http://localhost/api/routes-f/rewards/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/routes-f/rewards/redeem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(authedSession);
    ensureRewardsSchemaMock.mockResolvedValue(undefined);
    getRewardDefinitionMock.mockReturnValue({
      id: "featured-chat-highlight",
      name: "Featured Chat Highlight",
      cost: 250,
    });
  });

  it("returns 404 when the reward does not exist", async () => {
    getRewardDefinitionMock.mockReturnValue(null);

    const res = await POST(
      makeRequest({ reward_id: "missing-reward", quantity: 1 })
    );

    expect(res.status).toBe(404);
  });

  it("returns 409 when points are insufficient", async () => {
    withRewardsTransactionMock.mockResolvedValue({
      ok: false,
      balance: {
        pointsBalance: 100,
        tier: "Bronze",
      },
    });

    const res = await POST(
      makeRequest({ reward_id: "featured-chat-highlight", quantity: 1 })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toEqual({
      error: "Insufficient points",
      points_balance: 100,
      tier: "Bronze",
    });
  });

  it("returns redemption details after a successful atomic spend", async () => {
    withRewardsTransactionMock.mockResolvedValue({
      ok: true,
      balance: {
        pointsBalance: 750,
        tier: "Bronze",
      },
    });

    const res = await POST(
      makeRequest({ reward_id: "featured-chat-highlight", quantity: 1 })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(ensureRewardsSchemaMock).toHaveBeenCalled();
    expect(json).toEqual({
      reward_id: "featured-chat-highlight",
      reward_name: "Featured Chat Highlight",
      quantity: 1,
      points_spent: 250,
      points_balance: 750,
      tier: "Bronze",
    });
  });
});
