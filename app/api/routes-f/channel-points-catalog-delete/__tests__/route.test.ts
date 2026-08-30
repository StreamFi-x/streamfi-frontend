jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { verifySession } from "@/lib/auth/verify-session";
import { sql } from "@vercel/postgres";
import { DELETE } from "../route";

const verifySessionMock = verifySession as jest.Mock;
const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (rewardId?: string, body?: object) => {
  const url = rewardId ? `http://localhost/api/routes-f/channel-points-catalog-delete?rewardId=${rewardId}` : "http://localhost/api/routes-f/channel-points-catalog-delete";
  return new Request(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
};

describe("DELETE /api/routes-f/channel-points-catalog-delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when session is invalid", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const res = await DELETE(makeRequest("reward_1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when rewardId is missing", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const res = await DELETE(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/rewardId is required/i);
  });

  it("returns 403 when user does not own the reward", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "reward_1",
          user_id: "usr_other",
          creator_wallet: "GBBB...",
        },
      ],
    });

    const res = await DELETE(makeRequest("reward_1"));
    expect(res.status).toBe(403);
  });

  it("returns 409 when reward has pending redemptions", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "reward_1",
            user_id: "usr_1",
            creator_wallet: "GAAA...",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ count: 2 }],
      });

    const res = await DELETE(makeRequest("reward_1"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/pending redemptions/i);
  });

  it("returns 200 and deletes reward successfully when no pending redemptions exist", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "reward_1",
            user_id: "usr_1",
            creator_wallet: "GAAA...",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ count: 0 }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await DELETE(makeRequest("reward_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/deleted successfully/i);
  });
});
