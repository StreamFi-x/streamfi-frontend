/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, GET, DELETE } from "../route";

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/routes-f/stream-schedule", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/routes-f/stream-schedule", () => {
  it("schedules stream end successfully", async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        end_at: futureDate,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.stream_id).toBe("stream123");
    expect(body.end_at).toBe(futureDate);
    expect(body.scheduled).toBe(true);
    expect(body.fires_in_seconds).toBeGreaterThan(0);
  });

  it("rejects past time with 400", async () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        end_at: pastDate,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid ISO date with 400", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        end_at: "not-a-date",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing stream_id", async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const res = await POST(
      makeReq("POST", {
        end_at: futureDate,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing end_at", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/stream-schedule", () => {
  beforeEach(async () => {
    // Setup: create a schedule
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    await POST(
      makeReq("POST", {
        stream_id: "getstream",
        end_at: futureDate,
      })
    );
  });

  it("returns schedule for existing stream", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-schedule?stream_id=getstream"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stream_id).toBe("getstream");
    expect(body.scheduled).toBe(true);
  });

  it("returns 404 for non-existent stream", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-schedule?stream_id=nonexistent"
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when stream_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-schedule");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/routes-f/stream-schedule", () => {
  beforeEach(async () => {
    // Setup: create a schedule
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    await POST(
      makeReq("POST", {
        stream_id: "deletestream",
        end_at: futureDate,
      })
    );
  });

  it("cancels schedule successfully", async () => {
    const res = await DELETE(
      makeReq("DELETE", { stream_id: "deletestream" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 404 when deleting non-existent stream", async () => {
    const res = await DELETE(
      makeReq("DELETE", { stream_id: "nonexistent" })
    );
    expect(res.status).toBe(404);
  });

  it("rejects missing stream_id", async () => {
    const res = await DELETE(makeReq("DELETE", {}));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-schedule", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: "invalid json",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
