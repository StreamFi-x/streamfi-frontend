/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/admin-auth", () => ({
  authorizeAdmin: jest.fn(),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { authorizeAdmin } from "@/lib/admin-auth";
import { GET, POST, PATCH, DELETE } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const adminMock = authorizeAdmin as jest.Mock;

const tag = { id: "tag-1", title: "gaming", visibility: null };

const req = (method: string, search = "", body?: object) =>
  new NextRequest(`http://localhost/api/tags${search}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });

const allowAdmin = () =>
  adminMock.mockResolvedValue({
    ok: true,
    admin: { userId: "admin-user", privyId: null, role: "super_admin" },
    response: null,
  });

const denyAdmin = () =>
  adminMock.mockResolvedValue({
    ok: false,
    admin: null,
    response: Response.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    ),
  });

beforeEach(() => {
  jest.clearAllMocks();
  allowAdmin();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  sqlMock.mockResolvedValue({ rows: [tag] });
});

describe("GET /api/tags", () => {
  it("lists all tags without an admin check", async () => {
    const res = await GET(req("GET"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, tags: [tag] });
    expect(adminMock).not.toHaveBeenCalled();
  });

  it("runs a single query for the list, with no throwaway test query", async () => {
    await GET(req("GET"));

    expect(sqlMock).toHaveBeenCalledTimes(1);
    const [strings] = sqlMock.mock.calls[0];
    expect((strings as string[]).join(" ")).not.toContain("LIMIT 1");
  });

  it("filters by the title search param", async () => {
    const res = await GET(req("GET", "?title=gam"));

    expect(res.status).toBe(200);
    const [strings, ...values] = sqlMock.mock.calls[0];
    expect((strings as string[]).join(" ")).toContain("LIKE");
    expect(values).toContain("%gam%");
  });
});

describe("POST /api/tags", () => {
  it("rejects non-admins before touching the database", async () => {
    denyAdmin();

    const res = await POST(req("POST", "", { title: "gaming" }));

    expect(res.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("creates a tag for admins", async () => {
    const res = await POST(req("POST", "", { title: "gaming" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, tag });
    expect(adminMock).toHaveBeenCalledWith(expect.any(NextRequest), "tags");
  });
});

describe("PATCH /api/tags", () => {
  it("rejects non-admins before touching the database", async () => {
    denyAdmin();

    const res = await PATCH(
      req("PATCH", "?title=gaming", { newTitle: "fps" })
    );

    expect(res.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("updates a tag for admins", async () => {
    const res = await PATCH(
      req("PATCH", "?title=gaming", { newTitle: "fps" })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, tag });
    expect(adminMock).toHaveBeenCalledWith(expect.any(NextRequest), "tags");
  });
});

describe("DELETE /api/tags", () => {
  it("rejects non-admins before touching the database", async () => {
    denyAdmin();

    const res = await DELETE(req("DELETE", "?title=gaming"));

    expect(res.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("deletes a tag for admins", async () => {
    const res = await DELETE(req("DELETE", "?title=gaming"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, deleted: tag });
    expect(adminMock).toHaveBeenCalledWith(expect.any(NextRequest), "tags");
  });
});
