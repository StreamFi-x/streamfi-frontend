/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: { query: jest.fn() } }));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { POST } from "../route";

const sqlQuery = (sql as unknown as { query: jest.Mock }).query;

const ORIGINAL_ENV = process.env;

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/cron-refresh-materialized-views",
    {
      method: "POST",
      headers,
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-cron-secret" };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/routes-f/cron-refresh-materialized-views", () => {
  it("rejects requests without the correct CRON_SECRET bearer token", async () => {
    const res = await POST(req({ authorization: "Bearer wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("rejects requests when CRON_SECRET is not configured", async () => {
    process.env.CRON_SECRET = "";
    const res = await POST(req({ authorization: "Bearer wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("refreshes every configured view and returns 200 when all succeed", async () => {
    sqlQuery.mockResolvedValue({ rows: [] });

    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.succeeded).toBe(data.total);
    expect(data.failed).toBe(0);
    expect(sqlQuery).toHaveBeenCalledTimes(data.total);
  });

  it("returns 207 and per-view error detail when a refresh fails", async () => {
    sqlQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("could not create unique index"))
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(res.status).toBe(207);
    expect(data.failed).toBe(1);
    expect(
      data.results.some((r: { status: string }) => r.status === "failed")
    ).toBe(true);
  });

  it("continues refreshing remaining views after one fails", async () => {
    sqlQuery
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(sqlQuery).toHaveBeenCalledTimes(3);
    expect(data.succeeded).toBe(2);
    expect(data.failed).toBe(1);
  });
});
