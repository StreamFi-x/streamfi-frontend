/**
 * @jest-environment node
 *
 * Clips and recordings share the same keyset contract and query shape, so
 * both are exercised by one table of cases.
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => jest.fn().mockResolvedValue(false),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { encodeCursor } from "@/lib/pagination/cursor";
import { GET as clipsGET } from "@/app/api/streams/clips/route";
import { GET as recordingsGET } from "@/app/api/streams/recordings/route";

const sqlMock = sql as unknown as jest.Mock;

const row = (n: number, ts: string) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  title: `r${n}`,
  created_at: new Date(ts),
  cursor_ts: ts,
});

const endpoints = [
  ["clips", "/api/streams/clips", clipsGET, "c.created_at DESC, c.id DESC"],
  [
    "recordings",
    "/api/streams/recordings",
    recordingsGET,
    "r.created_at DESC, r.id DESC",
  ],
] as const;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe.each(endpoints)("GET %s", (_name, path, GET, orderBy) => {
  const req = (query = "") =>
    new NextRequest(`http://localhost${path}${query}`);

  it("returns { items, nextCursor, hasMore } with a stable compound order", async () => {
    const tie = "2026-09-25T10:00:00.500000Z";
    sqlMock.mockResolvedValue({
      rows: [row(3, tie), row(2, tie), row(1, tie)],
    });

    const res = await GET(req("?limit=2"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items.map((i: { title: string }) => i.title)).toEqual([
      "r3",
      "r2",
    ]);
    expect(body.items[0]).not.toHaveProperty("cursor_ts");
    expect(body).not.toHaveProperty("total");
    expect(body.hasMore).toBe(true);
    expect((sqlMock.mock.calls[0][0] as string[]).join("?")).toContain(
      `ORDER BY ${orderBy}`
    );
    // One query per request: the COUNT(*) that OFFSET pagination needed is gone.
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("resumes strictly after the cursor row", async () => {
    const ts = "2026-09-25T10:00:00.500000Z";
    const id = row(2, ts).id;
    sqlMock.mockResolvedValue({ rows: [] });

    await GET(req(`?cursor=${encodeCursor({ ts, id })}&limit=5`));

    expect(sqlMock.mock.calls[0].slice(-3)).toEqual([ts, id, 6]);
  });

  it("filters by username when given", async () => {
    sqlMock.mockResolvedValue({ rows: [] });

    await GET(req("?username=Alice"));

    const [strings, ...values] = sqlMock.mock.calls[0];
    expect((strings as string[]).join("?")).toContain("LOWER(");
    expect(values[0]).toBe("Alice");
  });

  it("caps the page size at 50", async () => {
    sqlMock.mockResolvedValue({ rows: [] });

    await GET(req("?limit=999"));

    expect(sqlMock.mock.calls[0].slice(-1)).toEqual([51]);
  });

  it.each([
    ["the retired offset parameter", "?offset=20"],
    ["a non-numeric limit (was NaN before)", "?limit=abc"],
    ["a tampered cursor", "?cursor=abc"],
  ])("rejects %s with 400", async (_case, query) => {
    const res = await GET(req(query));

    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 500 on a database error", async () => {
    sqlMock.mockRejectedValue(new Error("db down"));

    expect((await GET(req())).status).toBe(500);
  });
});
