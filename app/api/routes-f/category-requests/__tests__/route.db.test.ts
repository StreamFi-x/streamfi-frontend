/**
 * @jest-environment node
 *
 * Integration coverage for creator category submission (#1429): duplicate
 * detection, near-duplicate collision on the normalized key, and validation.
 */
jest.mock("@vercel/postgres", () => ({
  sql: Object.assign(jest.fn(), { query: jest.fn() }),
}));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));

import { sql } from "@vercel/postgres";
import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  TestSchema,
} from "@/test-utils/pg-test-db";
import { bindVercelSql } from "@/test-utils/vercel-sql-adapter";
import { GET, POST } from "../route";

jest.setTimeout(30_000);

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/category-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describeWithDb("category-requests (PostgreSQL)", () => {
  let schema: TestSchema;
  let creatorId: string;

  beforeEach(async () => {
    schema = await createTestSchema("catreq");
    await applyAppSchema(schema.pool);
    bindVercelSql(sql as never, schema.pool);

    const client = await schema.connect();
    try {
      const u = await client.query(
        `INSERT INTO users (username, wallet) VALUES ('creator1', 'GCREATOR1') RETURNING id`
      );
      creatorId = u.rows[0].id;
    } finally {
      await client.end();
    }

    (verifySession as jest.Mock).mockResolvedValue({ ok: true, userId: creatorId });
  });

  afterEach(async () => {
    await schema.drop();
  });

  it("creates a pending request", async () => {
    const res = await POST(
      postReq({ title: "Speedrunning", rationale: "lots of viewers want this category here" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("pending");
  });

  it("rejects a request for a title that is already an approved category", async () => {
    await sql`INSERT INTO stream_categories (title) VALUES ('Gaming')`;
    const res = await POST(
      postReq({ title: "gaming", rationale: "this category already exists somewhere" })
    );
    expect(res.status).toBe(409);
  });

  it("treats near-duplicate spellings as the same pending request", async () => {
    const first = await POST(
      postReq({ title: "Speedrunning", rationale: "first submission of this request" })
    );
    expect(first.status).toBe(201);

    const second = await POST(
      postReq({ title: "Speed Running", rationale: "second submission of this request" })
    );
    expect(second.status).toBe(409);
  });

  it("400s on a too-short rationale", async () => {
    const res = await POST(postReq({ title: "Music", rationale: "short" }));
    expect(res.status).toBe(400);
  });

  it("400s on a title with no letters or digits", async () => {
    const res = await POST(postReq({ title: "---", rationale: "punctuation only title here" }));
    expect(res.status).toBe(400);
  });

  it("lists only the caller's own requests", async () => {
    await POST(postReq({ title: "Music", rationale: "want a music category please" }));
    const other = await sql`INSERT INTO users (username, wallet) VALUES ('other', 'GOTHER') RETURNING id`;
    (verifySession as jest.Mock).mockResolvedValue({ ok: true, userId: other.rows[0].id });
    await POST(postReq({ title: "Cooking", rationale: "want a cooking category please" }));

    (verifySession as jest.Mock).mockResolvedValue({ ok: true, userId: creatorId });
    const res = await GET(new NextRequest("http://localhost/api/routes-f/category-requests"));
    const body = await res.json();
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].proposed_title).toBe("Music");
  });

  it("two creators racing the same normalized name yield exactly one pending request", async () => {
    const other = await sql`INSERT INTO users (username, wallet) VALUES ('other2', 'GOTHER2') RETURNING id`;
    const responses = await Promise.all([
      POST(postReq({ title: "Speedrunning", rationale: "creator one submits this" })),
      (async () => {
        (verifySession as jest.Mock).mockResolvedValueOnce({ ok: true, userId: other.rows[0].id });
        return POST(postReq({ title: "speed-running", rationale: "creator two submits this" }));
      })(),
    ]);
    const created = responses.filter(r => r.status === 201);
    expect(created.length).toBe(1);

    const { rows } = await sql`SELECT COUNT(*)::int AS n FROM category_requests WHERE status = 'pending'`;
    expect(rows[0].n).toBe(1);
  });
});
