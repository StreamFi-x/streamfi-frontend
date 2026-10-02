/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET as GETList, POST } from "../categories/route";
import { GET as GETBySlug, PATCH, DELETE } from "../categories/[slug]/route";

// ---------------------------------------------------------------------------
// Mock @vercel/postgres
// ---------------------------------------------------------------------------
const mockSql = jest.fn();

jest.mock("@vercel/postgres", () => ({
  sql: new Proxy(
    function (...args: unknown[]) {
      return mockSql(...args);
    },
    {
      get(_target, prop) {
        // Handle tagged-template usage: sql`...`
        if (prop === Symbol.toPrimitive || prop === "toString") {return undefined;}
        return mockSql;
      },
      apply(_target, _thisArg, args) {
        return mockSql(...args);
      },
    }
  ),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/auth/verify-session
// ---------------------------------------------------------------------------
const mockVerifySession = jest.fn();

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeReq(
  url: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> }
) {
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
}

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

// Produce a tagged-template-compatible mock: sql`...` returns a resolved Promise
function sqlResult(rows: Record<string, unknown>[], rowCount?: number) {
  return Promise.resolve({ rows, rowCount: rowCount ?? rows.length });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("/api/routes-f/categories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET list ──────────────────────────────────────────────────────────────
  describe("GET /api/routes-f/categories", () => {
    it("returns 200 with a categories array", async () => {
      // ensureCategoriesTable (CREATE TABLE) + ensureCategoriesTable (CREATE INDEX) + SELECT
      mockSql
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // CREATE INDEX
        .mockResolvedValueOnce({
          rows: [
            {
              slug: "gaming",
              name: "Gaming",
              thumbnail_url: null,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              stream_count: 3,
              viewer_count: 900,
            },
          ],
          rowCount: 1,
        });

      const req = makeReq("http://localhost/api/routes-f/categories");
      const res = await GETList();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty("categories");
      expect(Array.isArray(data.categories)).toBe(true);
      expect(data.categories[0].slug).toBe("gaming");
    });
  });

  // ── POST create ───────────────────────────────────────────────────────────
  describe("POST /api/routes-f/categories", () => {
    it("returns 201 when admin creates a category", async () => {
      // verifySession returns ok
      mockVerifySession.mockResolvedValue({
        ok: true,
        userId: "admin-user-id",
        response: undefined,
      });

      mockSql
        // requireAdmin SELECT users
        .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 })
        // ensureCategoriesTable CREATE TABLE
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // ensureCategoriesTable CREATE INDEX
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // INSERT
        .mockResolvedValueOnce({
          rows: [
            {
              slug: "gaming",
              name: "Gaming",
              thumbnail_url: null,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          rowCount: 1,
        });

      const req = makeReq("http://localhost/api/routes-f/categories", {
        method: "POST",
        body: { title: "Gaming" },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.slug).toBe("gaming");
      expect(data.name).toBe("Gaming");
    });

    it("returns 403 for non-admin user", async () => {
      mockVerifySession.mockResolvedValue({
        ok: true,
        userId: "regular-user-id",
        response: undefined,
      });

      // requireAdmin SELECT users returns no rows → not an admin
      mockSql.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const req = makeReq("http://localhost/api/routes-f/categories", {
        method: "POST",
        body: { title: "Sports" },
      });
      const res = await POST(req);
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.error).toBe("Forbidden");
    });
  });

  // ── GET by slug ───────────────────────────────────────────────────────────
  describe("GET /api/routes-f/categories/[slug]", () => {
    it("returns 404 for an unknown slug", async () => {
      mockSql
        // ensureCategoriesTable CREATE TABLE
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // SELECT category by slug → not found
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const req = makeReq(
        "http://localhost/api/routes-f/categories/does-not-exist"
      );
      const res = await GETBySlug(req, makeParams("does-not-exist"));
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe("Category not found");
    });
  });

  // ── PATCH ─────────────────────────────────────────────────────────────────
  describe("PATCH /api/routes-f/categories/[slug]", () => {
    it("admin updates category and returns updated category", async () => {
      mockVerifySession.mockResolvedValue({
        ok: true,
        userId: "admin-user-id",
        response: undefined,
      });

      mockSql
        // requireAdmin SELECT users
        .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 })
        // ensureCategoriesTable CREATE TABLE
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // SELECT existing category
        .mockResolvedValueOnce({
          rows: [
            { slug: "gaming", name: "Gaming", thumbnail_url: null },
          ],
          rowCount: 1,
        })
        // UPDATE
        .mockResolvedValueOnce({
          rows: [
            {
              slug: "gaming-updated",
              name: "Gaming Updated",
              thumbnail_url: null,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-06-01T00:00:00Z",
            },
          ],
          rowCount: 1,
        });

      const req = makeReq(
        "http://localhost/api/routes-f/categories/gaming",
        {
          method: "PATCH",
          body: { title: "Gaming Updated" },
        }
      );
      const res = await PATCH(req, makeParams("gaming"));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.name).toBe("Gaming Updated");
    });
  });

  // ── DELETE ────────────────────────────────────────────────────────────────
  describe("DELETE /api/routes-f/categories/[slug]", () => {
    it("admin deletes category and returns success message", async () => {
      mockVerifySession.mockResolvedValue({
        ok: true,
        userId: "admin-user-id",
        response: undefined,
      });

      mockSql
        // requireAdmin SELECT users
        .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 })
        // ensureCategoriesTable CREATE TABLE
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // DELETE
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const req = makeReq(
        "http://localhost/api/routes-f/categories/gaming",
        { method: "DELETE" }
      );
      const res = await DELETE(req, makeParams("gaming"));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.message).toBe("Category removed");
    });
  });
});
