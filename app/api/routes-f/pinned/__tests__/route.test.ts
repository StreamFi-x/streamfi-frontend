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
import { POST } from "../route";
import { PATCH } from "../reorder/route";

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

const makeRequest = (method: string, path: string, body?: object) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

describe("routes-f pinned", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(authedSession);
  });

  it("enforces max 6 pinned items", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "recording-1" }] })
      .mockResolvedValueOnce({
        rows: Array.from({ length: 6 }, (_, index) => ({ id: `pin-${index}` })),
      });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/pinned", {
        item_id: "11111111-1111-1111-1111-111111111111",
        item_type: "recording",
        position: 0,
      })
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringMatching(/at most 6/i),
    });
  });

  it("validates reorder IDs belong to creator", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }],
      });

    const res = await PATCH(
      makeRequest("PATCH", "/api/routes-f/pinned/reorder", {
        ordered_ids: ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"],
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringMatching(/authenticated creator/i),
    });
  });
});
