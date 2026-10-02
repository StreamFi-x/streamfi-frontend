/**
 * @jest-environment node
 *
 * Integration coverage for admin category review (#1429): authorization,
 * approve/reject/merge, approved-category selectability, and two-admin race
 * safety on the same request.
 */
jest.mock("@vercel/postgres", () => ({
  sql: Object.assign(jest.fn(), { query: jest.fn() }),
  db: { connect: jest.fn() },
}));
const mockAdmin = jest.fn();
jest.mock("@/lib/admin-auth", () => ({
  requireAdminSession: async () =>
    (await mockAdmin())
      ? null
      : Response.json({ error: "Unauthorized" }, { status: 401 }),
  requireAdminIdentity: async () => {
    const admin = await mockAdmin();
    return admin
      ? { admin, response: null }
      : { admin: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  },
}));
jest.mock("@/lib/cache/invalidation", () => ({
  invalidateCategoryCaches: jest.fn(),
}));

import { db, sql } from "@vercel/postgres";
import { NextRequest } from "next/server";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  TestSchema,
} from "@/test-utils/pg-test-db";
import { bindVercelSql } from "@/test-utils/vercel-sql-adapter";
import { GET as reviewQueue } from "../route";
import { PATCH as decide } from "../[id]/route";

/**
 * withTransaction (lib/postgres-transaction.ts) calls db.connect() for a
 * single pooled connection, separate from the `sql` tag bindVercelSql wires.
 * This wraps a pg PoolClient with the same tagged-template `.sql` interface
 * so BEGIN/COMMIT/ROLLBACK run on one real connection.
 */
function mockDbConnect(pool: import("pg").Pool) {
  (db.connect as jest.Mock).mockImplementation(async () => {
    const client = await pool.connect();
    return {
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
        const text = strings.reduce(
          (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
          ""
        );
        return client.query(text, values);
      },
      release: (destroy?: boolean) => client.release(destroy),
    };
  });
}

jest.setTimeout(30_000);

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/category-requests/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describeWithDb("admin/category-requests review (PostgreSQL)", () => {
  let schema: TestSchema;
  let creatorId: string;

  beforeEach(async () => {
    schema = await createTestSchema("catrev");
    await applyAppSchema(schema.pool);
    bindVercelSql(sql as never, schema.pool);
    mockDbConnect(schema.pool);
    mockAdmin.mockResolvedValue("admin-privy-id");

    const client = await schema.connect();
    try {
      const u = await client.query(
        `INSERT INTO users (username, wallet) VALUES ('creator1', 'GCREATOR1') RETURNING id`
      );
      creatorId = u.rows[0].id;
    } finally {
      await client.end();
    }
  });

  afterEach(async () => {
    await schema.drop();
  });

  async function createRequest(title: string, normalizedKey: string) {
    const { rows } = await sql`
      INSERT INTO category_requests (requested_by, proposed_title, normalized_key, rationale)
      VALUES (${creatorId}, ${title}, ${normalizedKey}, 'a good rationale for this request')
      RETURNING id
    `;
    return rows[0].id as string;
  }

  it("401s a non-admin", async () => {
    mockAdmin.mockResolvedValue(null);
    const res = await reviewQueue(new NextRequest("http://localhost/api/admin/category-requests"));
    expect(res.status).toBe(401);
  });

  it("lists pending requests with near-duplicate suggestions", async () => {
    await sql`INSERT INTO stream_categories (title) VALUES ('Speed Running')`;
    await createRequest("Speedrunning", "speedrunning");

    const res = await reviewQueue(new NextRequest("http://localhost/api/admin/category-requests"));
    const body = await res.json();
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].similarCategories.length).toBeGreaterThan(0);
  });

  it("approve creates the category and it becomes selectable via /api/category's own table", async () => {
    const id = await createRequest("Speedrunning", "speedrunning");
    const res = await decide(patchReq({ decision: "approve" }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);

    const { rows } = await sql`SELECT id, title FROM stream_categories WHERE title = 'Speedrunning'`;
    expect(rows).toHaveLength(1);

    const { rows: reqRows } = await sql`SELECT status, category_id FROM category_requests WHERE id = ${id}`;
    expect(reqRows[0].status).toBe("approved");
    expect(reqRows[0].category_id).toBe(rows[0].id);
  });

  it("reject requires a reason and records it", async () => {
    const id = await createRequest("Nonsense", "nonsense");
    const badRes = await decide(patchReq({ decision: "reject" }), { params: Promise.resolve({ id }) });
    expect(badRes.status).toBe(400);

    const res = await decide(
      patchReq({ decision: "reject", reason: "does not fit the taxonomy" }),
      { params: Promise.resolve({ id }) }
    );
    expect(res.status).toBe(200);
    const { rows } = await sql`SELECT status, decision_reason FROM category_requests WHERE id = ${id}`;
    expect(rows[0].status).toBe("rejected");
    expect(rows[0].decision_reason).toBe("does not fit the taxonomy");
  });

  it("merge adds the proposed title as a tag on the target category, no duplicate category created", async () => {
    const { rows: target } = await sql`INSERT INTO stream_categories (title) VALUES ('Gaming') RETURNING id`;
    const id = await createRequest("Speed Running", "speedrunning");

    const res = await decide(
      patchReq({ decision: "merge", categoryId: target[0].id }),
      { params: Promise.resolve({ id }) }
    );
    expect(res.status).toBe(200);

    const { rows } = await sql`SELECT tags FROM stream_categories WHERE id = ${target[0].id}`;
    expect(rows[0].tags).toContain("Speed Running");

    const { rows: allCategories } = await sql`SELECT COUNT(*)::int AS n FROM stream_categories`;
    expect(allCategories[0].n).toBe(1);
  });

  it("rejects deciding an already-decided request", async () => {
    const id = await createRequest("Speedrunning", "speedrunning");
    await decide(patchReq({ decision: "approve" }), { params: Promise.resolve({ id }) });
    const second = await decide(
      patchReq({ decision: "reject", reason: "too late to reject this now" }),
      { params: Promise.resolve({ id }) }
    );
    expect(second.status).toBe(409);
  });

  it("two admins deciding the same request concurrently: exactly one decision wins", async () => {
    const id = await createRequest("Speedrunning", "speedrunning");
    const responses = await Promise.all([
      decide(patchReq({ decision: "approve" }), { params: Promise.resolve({ id }) }),
      decide(patchReq({ decision: "reject", reason: "concurrent rejection attempt here" }), {
        params: Promise.resolve({ id }),
      }),
    ]);
    const succeeded = responses.filter(r => r.status === 200);
    const conflicted = responses.filter(r => r.status === 409);
    expect(succeeded.length).toBe(1);
    expect(conflicted.length).toBe(1);
  });
});
