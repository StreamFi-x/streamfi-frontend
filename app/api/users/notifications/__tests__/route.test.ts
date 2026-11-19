/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { encodeCursor } from "@/lib/pagination/cursor";
import { GET, PATCH } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const sessionMock = verifySession as jest.Mock;
const USER = "11111111-1111-4111-8111-111111111111";

const req = (method: string, query = "") =>
  new NextRequest(`http://localhost/api/users/notifications${query}`, {
    method,
  });

const row = (n: number, ts = `2026-09-25T10:00:0${n}.000000Z`) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  type: "follow",
  title: `t${n}`,
  body: `b${n}`,
  is_read: n % 2 === 0,
  created_at: new Date(ts),
  cursor_ts: ts,
});

/** First sql call is the page, second is the unread count. */
function mockQueries(rows: unknown[], unread = "0") {
  sqlMock.mockImplementation((strings: TemplateStringsArray) =>
    Promise.resolve(
      strings.join("?").includes("count(*)")
        ? { rows: [{ count: unread }] }
        : { rows }
    )
  );
}

const pageCall = () =>
  sqlMock.mock.calls.find(
    ([s]) => !(s as string[]).join("?").includes("count(*)")
  )!;

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({ ok: true, userId: USER });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/users/notifications", () => {
  it("requires a session", async () => {
    sessionMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const res = await GET(req("GET"));

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns a page in the legacy item shape plus the unread count", async () => {
    mockQueries([row(3), row(2)], "7");

    const res = await GET(req("GET"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toMatchObject({
      hasMore: false,
      nextCursor: null,
      unreadCount: 7,
    });
    expect(body.items[0]).toEqual({
      id: row(3).id,
      type: "follow",
      title: "t3",
      text: "b3",
      read: false,
      created_at: "2026-09-25T10:00:03.000Z",
    });
  });

  it("filters by the session user, never by anything in the cursor", async () => {
    mockQueries([]);
    const cursor = encodeCursor({
      ts: "2026-09-25T10:00:00.000000Z",
      id: row(1).id,
    });

    await GET(req("GET", `?cursor=${cursor}&limit=5`));

    expect(pageCall().slice(1)).toEqual([
      USER,
      "2026-09-25T10:00:00.000000Z",
      row(1).id,
      6,
    ]);
  });

  it("paginates with limit + 1 and caps the page size at 50", async () => {
    mockQueries([row(3), row(2), row(1)]);

    const body = await (await GET(req("GET", "?limit=2"))).json();
    expect(body.items).toHaveLength(2);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toEqual(expect.any(String));

    sqlMock.mockClear();
    mockQueries([]);
    await GET(req("GET", "?limit=5000"));
    expect(pageCall()[4]).toBe(51);
  });

  it("rejects an invalid cursor with 400 without querying", async () => {
    const res = await GET(req("GET", "?cursor=garbage"));

    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the query fails", async () => {
    sqlMock.mockRejectedValue(new Error("db down"));

    expect((await GET(req("GET"))).status).toBe(500);
  });
});

describe("PATCH /api/users/notifications", () => {
  it("marks only the caller's unread notifications as read", async () => {
    sqlMock.mockResolvedValue({ rows: [] });

    const res = await PATCH(req("PATCH"));

    expect(res.status).toBe(200);
    const [strings, userId] = sqlMock.mock.calls[0];
    expect((strings as string[]).join("?")).toContain("UPDATE notifications");
    expect((strings as string[]).join("?")).toContain("is_read = false");
    expect(userId).toBe(USER);
  });
});
