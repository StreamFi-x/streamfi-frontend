jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));
jest.mock("@vercel/postgres", () => ({ sql: { query: jest.fn() } }));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET } from "../route";

const sqlQuery = (sql as unknown as { query: jest.Mock }).query;
const verify = verifySession as unknown as jest.Mock;

function req(qs = ""): any {
  return new Request(`http://localhost/api/routes-f/donations/history${qs}`);
}

const row = {
  id: "t1",
  amount_usdc: "5.00",
  message: "thanks!",
  tx_hash: "hash1",
  created_at: "2026-05-01T00:00:00.000Z",
  sender_username: "alice",
  recipient_username: "bob",
};

beforeEach(() => {
  jest.clearAllMocks();
  verify.mockResolvedValue({ ok: true, userId: "user-1" });
});

describe("GET /api/routes-f/donations/history", () => {
  it("returns the session's 401 response when unauthenticated", async () => {
    verify.mockResolvedValue({ ok: false, response: new Response("no", { status: 401 }) });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("rejects an invalid direction", async () => {
    const res = await GET(req("?direction=weird"));
    expect(res.status).toBe(400);
  });

  it("rejects a non-ISO from date", async () => {
    const res = await GET(req("?from=not-a-date"));
    expect(res.status).toBe(400);
  });

  it("returns the user's donation history", async () => {
    sqlQuery.mockResolvedValue({ rows: [row] });
    const res = await GET(req("?direction=all&limit=20"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.donations).toHaveLength(1);
    expect(json.donations[0]).toMatchObject({
      amount_usdc: "5.00",
      sender_username: "alice",
      recipient_username: "bob",
    });
    expect(json.pagination.hasMore).toBe(false);
  });

  it("sets hasMore + nextCursor when an extra row is returned", async () => {
    const rows = Array.from({ length: 3 }, (_, k) => ({ ...row, id: `t${k}` }));
    sqlQuery.mockResolvedValue({ rows });
    const res = await GET(req("?limit=2"));
    const json = await res.json();
    expect(json.donations).toHaveLength(2);
    expect(json.pagination.hasMore).toBe(true);
    expect(json.pagination.nextCursor).toBe("2026-05-01T00:00:00.000Z");
  });
});
