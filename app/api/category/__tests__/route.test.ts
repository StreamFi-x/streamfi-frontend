/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("next/cache", () => ({ revalidateTag: jest.fn() }));
jest.mock("@/lib/admin-auth", () => ({
  requireAdminSession: jest.fn(),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { revalidateTag } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { resetAppCacheForTests } from "@/lib/cache";
import { GET, PATCH, POST, DELETE } from "../route";
import { GET as GET_BY_TITLE } from "../[title]/route";

const sqlMock = sql as unknown as jest.Mock;
const adminMock = requireAdminSession as jest.Mock;

const gaming = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Gaming",
  description: "Games",
  tags: ["esports"],
  imageurl: "/g.png",
};

const req = (method: string, search = "", body?: object) =>
  new NextRequest(`http://localhost/api/category${search}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });

const listReads = () =>
  sqlMock.mock.calls.filter(([s]) =>
    (s as string[]).join("?").includes("ORDER BY created_at DESC, id DESC")
  );

beforeEach(() => {
  jest.clearAllMocks();
  resetAppCacheForTests();
  adminMock.mockResolvedValue(null);
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  sqlMock.mockImplementation((strings: TemplateStringsArray) => {
    const text = strings.join("?");
    if (text.includes("ORDER BY created_at DESC, id DESC")) {
      return Promise.resolve({ rows: [gaming] });
    }
    if (text.includes("SELECT id FROM stream_categories")) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [gaming], rowCount: 1 });
  });
});

function expectEdgeCachedAndPurgeable(res: Response) {
  expect(res.headers.get("Vercel-Cache-Tag")).toBe("categories");
  expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe(
    "public, max-age=86400, stale-while-revalidate=604800"
  );
  // Browsers revalidate every time: a purge cannot reach a browser copy.
  expect(res.headers.get("Cache-Control")).toMatch(/^public, max-age=0,/);
  expect(res.headers.get("Set-Cookie")).toBeNull();
}

describe("GET /api/category", () => {
  it.each(["", "?id=gaming", "?title=gam", "?tag=esp"])(
    "%s is served edge-cached under the purgeable tag without an auth check",
    async search => {
      const res = await GET(req("GET", search));

      expect(res.status).toBe(200);
      expectEdgeCachedAndPurgeable(res);
      expect(adminMock).not.toHaveBeenCalled();
    }
  );

  it("serves all read variants from one database read", async () => {
    for (const search of [
      "",
      "?id=gaming",
      "?title=g",
      "?title=ga",
      "?tag=e",
    ]) {
      await GET(req("GET", search));
    }
    await GET_BY_TITLE(req("GET"), {
      params: Promise.resolve({ title: "gaming" }),
    });

    expect(listReads()).toHaveLength(1);
  });

  it("keeps the list response shape", async () => {
    const body = await (await GET(req("GET"))).json();

    expect(body).toEqual({
      success: true,
      categories: [
        {
          id: gaming.id,
          title: "Gaming",
          tags: ["esports"],
          imageurl: "/g.png",
        },
      ],
    });
  });

  it("does not let the CDN hold a 404 or an error", async () => {
    const missing = await GET(req("GET", "?id=nope"));
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Vercel-CDN-Cache-Control")).toBeNull();

    resetAppCacheForTests();
    sqlMock.mockRejectedValue(new Error("db down"));
    const failed = await GET(req("GET"));
    expect(failed.status).toBe(500);
    expect(failed.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
  });
});

describe("GET /api/category/[title]", () => {
  it("returns the category with description, edge-cached", async () => {
    const res = await GET_BY_TITLE(req("GET"), {
      params: Promise.resolve({ title: "GAMING" }),
    });

    expect(res.status).toBe(200);
    expectEdgeCachedAndPurgeable(res);
    expect((await res.json()).category).toEqual(gaming);
  });
});

describe("category writes purge the edge", () => {
  it.each([
    ["POST", () => POST(req("POST", "", { title: "Art" }))],
    ["PATCH", () => PATCH(req("PATCH", "?id=gaming", { description: "d" }))],
    ["DELETE", () => DELETE(req("DELETE", "?id=gaming"))],
  ])(
    "%s purges the categories tag and the next read is fresh",
    async (_m, write) => {
      await GET(req("GET"));
      expect(listReads()).toHaveLength(1);

      const res = await write();

      expect(res.status).toBeLessThan(300);
      expect(revalidateTag).toHaveBeenCalledWith("categories", { expire: 0 });
      await GET(req("GET"));
      expect(listReads()).toHaveLength(2);
    }
  );

  it("PATCH without tags keeps the existing tags", async () => {
    await PATCH(req("PATCH", "?id=gaming", { description: "d" }));

    const update = sqlMock.mock.calls.find(([s]) =>
      (s as string[]).join("?").includes("UPDATE stream_categories")
    )!;
    // Values: title, description, tags, imageurl, is_active, titleKey
    expect(update[3]).toBeNull();
  });

  it("rejects a non-admin before touching data", async () => {
    adminMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await PATCH(req("PATCH", "?id=gaming", { title: "x" }));

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});
