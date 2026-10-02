/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => {
  const sqlMock = jest.fn();
  return { sql: sqlMock };
});

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;

const ORIGINAL_ENV = process.env;

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/cron-cleanup-expired-clips",
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

describe("POST /api/routes-f/cron-cleanup-expired-clips", () => {
  it("rejects requests without the correct CRON_SECRET bearer token", async () => {
    const res = await POST(req({ authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
  });

  it("rejects requests missing the authorization header entirely", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("deletes failed clip jobs older than 24 hours and reports the count", async () => {
    sqlMock.mockResolvedValue({ rows: [{ id: "job-1" }, { id: "job-2" }] });

    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.removed_count).toBe(2);
    expect(data.removed_ids).toEqual(["job-1", "job-2"]);
    expect(data.max_age_hours).toBe(24);
  });

  it("returns removed_count 0 when nothing is expired", async () => {
    sqlMock.mockResolvedValue({ rows: [] });

    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(data.removed_count).toBe(0);
    expect(data.removed_ids).toEqual([]);
  });

  it("returns 500 when the delete query fails", async () => {
    sqlMock.mockRejectedValue(new Error("connection lost"));

    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    expect(res.status).toBe(500);
  });
});
