/** @jest-environment node */
jest.mock("@/lib/admin-auth", () => ({
  authorizeAdmin: jest.fn().mockResolvedValue({
    ok: true,
    admin: { userId: "admin-user" },
    response: null,
  }),
}));
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;

const rows = Array.from({ length: 21 }, (_, index) => ({
  id: `user-${index}`,
}));

function requestFor(filter: string, q?: string): NextRequest {
  const params = new URLSearchParams({ filter });
  if (q !== undefined) {
    params.set("q", q);
  }
  return new NextRequest(`https://streamfi.media/api/admin/users?${params}`);
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sqlMock.mockResolvedValue({ rows });
  });

  it.each([
    ["banned", "moderator"],
    ["banned", ""],
    ["live", "creator"],
    ["live", ""],
    ["all", "user"],
    ["all", ""],
  ] as const)(
    "uses deterministic ordering for the %s%s query",
    async (filter, q) => {
      const response = await GET(requestFor(filter, q));

      expect(response.status).toBe(200);
      expect(sqlMock).toHaveBeenCalledTimes(1);
      expect(sqlMock.mock.calls[0][0].join(" ")).toContain(
        "ORDER BY created_at DESC, id DESC"
      );
    }
  );

  it("trims the extra row and reports whether another page exists", async () => {
    const response = await GET(
      new NextRequest("https://streamfi.media/api/admin/users?page=2")
    );

    expect(await response.json()).toEqual({
      users: rows.slice(0, 20),
      page: 2,
      limit: 20,
      hasMore: true,
    });
    expect(sqlMock.mock.calls[0][1]).toBe(21);
  });

  it("reports no next page when the query returns at most one page", async () => {
    sqlMock.mockResolvedValueOnce({ rows: rows.slice(0, 20) });

    const response = await GET(
      new NextRequest("https://streamfi.media/api/admin/users")
    );

    expect(await response.json()).toMatchObject({
      users: rows.slice(0, 20),
      hasMore: false,
    });
  });
});
