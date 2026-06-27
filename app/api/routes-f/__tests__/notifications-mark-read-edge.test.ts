/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../notifications/mark-read/route";
import { resetStore } from "../notifications/mark-read/store";

function makeReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/notifications/mark-read",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

beforeEach(() => resetStore());

describe("POST /api/routes-f/notifications/mark-read — edge cases", () => {
  it("returns 400 when viewer_id is missing", async () => {
    const res = await POST(makeReq({ ids: ["n_001"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when neither ids nor all is provided", async () => {
    const res = await POST(makeReq({ viewer_id: "viewer_001" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when ids is an empty array", async () => {
    const res = await POST(makeReq({ viewer_id: "viewer_001", ids: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/notifications/mark-read",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 0 updated_count for unknown ids", async () => {
    const res = await POST(
      makeReq({ viewer_id: "viewer_001", ids: ["n_999", "n_000"] })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated_count).toBe(0);
  });

  it("returns 0 updated_count for unknown viewer_id with all=true", async () => {
    const res = await POST(makeReq({ viewer_id: "unknown_viewer", all: true }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated_count).toBe(0);
  });

  it("does not mark notifications belonging to another viewer", async () => {
    const res = await POST(
      makeReq({ viewer_id: "viewer_002", ids: ["n_001"] })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated_count).toBe(0);
  });
});
