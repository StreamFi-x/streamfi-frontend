/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => {
  const sqlMock = jest.fn();
  return { sql: sqlMock };
});
jest.mock("@/lib/admin-auth", () => ({
  verifyAdminSession: jest.fn(),
  adminUnauthorized: jest.fn(() =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession } from "@/lib/admin-auth";
import { PUT } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifyAdmin = verifyAdminSession as jest.Mock;

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/featured-streams-set", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  verifyAdmin.mockResolvedValue(true);
  sqlMock.mockResolvedValue({ rows: [] });
});

describe("PUT /api/routes-f/featured-streams-set", () => {
  it("rejects non-admin requests", async () => {
    verifyAdmin.mockResolvedValue(false);

    const res = await PUT(req({ stream_ids: ["s1", "s2"] }));
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects a body missing stream_ids", async () => {
    const res = await PUT(req({}));
    expect(res.status).toBe(400);
  });

  it("rejects a non-array stream_ids", async () => {
    const res = await PUT(req({ stream_ids: "s1" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty array", async () => {
    const res = await PUT(req({ stream_ids: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects more than the maximum allowed entries", async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `stream-${i}`);
    const res = await PUT(req({ stream_ids: tooMany }));
    expect(res.status).toBe(400);
  });

  it("rejects non-string entries", async () => {
    const res = await PUT(req({ stream_ids: ["s1", 42] }));
    expect(res.status).toBe(400);
  });

  it("rejects duplicate stream ids", async () => {
    const res = await PUT(req({ stream_ids: ["s1", "s2", "s1"] }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON bodies", async () => {
    const malformed = new NextRequest(
      "http://localhost/api/routes-f/featured-streams-set",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }
    );
    const res = await PUT(malformed);
    expect(res.status).toBe(400);
  });

  it("replaces the featured streams list and preserves order", async () => {
    const res = await PUT(req({ stream_ids: ["s3", "s1", "s2"] }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stream_ids).toEqual(["s3", "s1", "s2"]);
    expect(data.count).toBe(3);

    // BEGIN, DELETE, 3x INSERT, COMMIT
    expect(sqlMock).toHaveBeenCalledTimes(6);
  });

  it("rolls back the transaction when an insert fails", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // DELETE
      .mockRejectedValueOnce(new Error("insert failed")); // first INSERT

    const res = await PUT(req({ stream_ids: ["s1", "s2"] }));
    expect(res.status).toBe(500);

    const rollbackCall = sqlMock.mock.calls.find(call =>
      String(call[0]?.[0] ?? call[0]).includes("ROLLBACK")
    );
    expect(rollbackCall).toBeTruthy();
  });
});
