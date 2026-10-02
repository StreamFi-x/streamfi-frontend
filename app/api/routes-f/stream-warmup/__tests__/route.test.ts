/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, GET, DELETE } from "../route";

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/routes-f/stream-warmup", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/routes-f/stream-warmup", () => {
  it("creates warmup state successfully", async () => {
    const res = await POST(
      makeReq("POST", {
        username: "testuser",
        warmup_message: "Starting soon!",
        teaser_image_url: "https://example.com/teaser.jpg",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.warmup_active).toBe(true);
    expect(body.started_at).toBeDefined();
    expect(body.warmup_message).toBe("Starting soon!");
    expect(body.teaser_image_url).toBe("https://example.com/teaser.jpg");
  });

  it("creates warmup state with minimal fields", async () => {
    const res = await POST(makeReq("POST", { username: "minimaluser" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.warmup_active).toBe(true);
    expect(body.started_at).toBeDefined();
    expect(body.warmup_message).toBeUndefined();
    expect(body.teaser_image_url).toBeUndefined();
  });

  it("rejects missing username", async () => {
    const res = await POST(
      makeReq("POST", { warmup_message: "test" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-warmup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/stream-warmup", () => {
  beforeEach(async () => {
    // Setup: create a warmup state
    await POST(makeReq("POST", { username: "getuser", warmup_message: "Test" }));
  });

  it("returns warmup state for existing user", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-warmup?username=getuser"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.warmup_active).toBe(true);
    expect(body.warmup_message).toBe("Test");
  });

  it("returns 404 for non-existent user", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-warmup?username=nonexistent"
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when username is missing", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-warmup");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/routes-f/stream-warmup", () => {
  beforeEach(async () => {
    // Setup: create a warmup state
    await POST(makeReq("POST", { username: "deleteuser" }));
  });

  it("clears warmup state successfully", async () => {
    const res = await DELETE(makeReq("DELETE", { username: "deleteuser" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 404 when deleting non-existent user", async () => {
    const res = await DELETE(
      makeReq("DELETE", { username: "nonexistent" })
    );
    expect(res.status).toBe(404);
  });

  it("rejects missing username", async () => {
    const res = await DELETE(makeReq("DELETE", {}));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-warmup", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: "invalid json",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
