/**
 * debug/migrate-chat route tests (#1612).
 * This runs schema-mutating DDL against production and must require
 * MIGRATE_CHAT_SECRET before touching the database at all.
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (search?: string) =>
  new Request(`http://localhost/api/debug/migrate-chat${search ?? ""}`, {
    method: "GET",
  });

const ORIGINAL_ENV = process.env;

describe("GET /api/debug/migrate-chat", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    sqlMock.mockReset();
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns 403 and never touches the database when MIGRATE_CHAT_SECRET is not configured", async () => {
    delete process.env.MIGRATE_CHAT_SECRET;

    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 403 and never touches the database when the secret is wrong", async () => {
    process.env.MIGRATE_CHAT_SECRET = "correct-secret";

    const res = await GET(makeRequest("?secret=wrong"));

    expect(res.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("proceeds to query the database when the correct secret is supplied", async () => {
    process.env.MIGRATE_CHAT_SECRET = "correct-secret";
    sqlMock.mockResolvedValue({ rows: [] });

    await GET(makeRequest("?secret=correct-secret"));

    expect(sqlMock).toHaveBeenCalled();
  });
});
