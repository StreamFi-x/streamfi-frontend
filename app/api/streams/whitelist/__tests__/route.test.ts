/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => jest.fn().mockResolvedValue(false),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const sessionMock = verifySession as jest.Mock;
const STREAMER = "22222222-2222-4222-8222-222222222222";

const req = (query = "") =>
  new NextRequest(`http://localhost/api/streams/whitelist${query}`);

const entry = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  identifier: `user${n}`,
  created_at: "2026-09-25T10:00:00.000Z",
  cursor_ts: "2026-09-25T10:00:00.000000Z",
  username: `user${n}`,
  avatar: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({
    ok: true,
    userId: STREAMER,
    username: "streamer",
  });
});

describe("GET /api/streams/whitelist (streamer's own list)", () => {
  it("requires a session", async () => {
    sessionMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    expect((await GET(req())).status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns a bounded first page scoped to the session's streamer", async () => {
    sqlMock.mockResolvedValue({
      rows: Array.from({ length: 51 }, (_, i) => entry(i % 10)),
    });

    const body = await (await GET(req())).json();

    expect(body.items).toHaveLength(50);
    expect(body.hasMore).toBe(true);
    expect(body.items[0]).not.toHaveProperty("cursor_ts");
    const [strings, ...values] = sqlMock.mock.calls[0];
    expect(values).toEqual([
      STREAMER,
      "infinity",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      51,
    ]);
    expect((strings as string[]).join("?")).toContain(
      "ORDER BY sw.created_at DESC, sw.id DESC"
    );
  });

  it("caps limit at 100 and rejects a bad cursor", async () => {
    sqlMock.mockResolvedValue({ rows: [] });
    await GET(req("?limit=1000"));
    expect(sqlMock.mock.calls[0][4]).toBe(101);

    sqlMock.mockClear();
    expect((await GET(req("?cursor=xyz"))).status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("leaves the viewer access check unpaginated", async () => {
    sqlMock.mockResolvedValue({ rows: [{ id: "x" }] });

    const body = await (await GET(req("?streamer=bob&limit=abc"))).json();

    expect(body).toEqual({ allowed: true });
  });
});
