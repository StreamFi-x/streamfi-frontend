/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, GET, DELETE, _resetStore } from "../route";
import { POST as checkPOST } from "../check/route";

function makeReq(method: string, url: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "Content-Type": "application/json" },
  });
}

const BASE = "/api/routes-f/block-user";

describe("Block User API", () => {
  beforeEach(() => _resetStore());

  // ── POST block ────────────────────────────────────────────────────────────

  it("blocks a user (POST)", async () => {
    const res = await POST(makeReq("POST", BASE, { blocker_id: "u1", blocked_id: "u2", reason: "spam" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.blocked_at).toBeDefined();
  });

  it("400 when blocker_id is missing", async () => {
    const res = await POST(makeReq("POST", BASE, { blocked_id: "u2" }));
    expect(res.status).toBe(400);
  });

  it("400 when user tries to block themselves", async () => {
    const res = await POST(makeReq("POST", BASE, { blocker_id: "u1", blocked_id: "u1" }));
    expect(res.status).toBe(400);
  });

  // ── GET list ──────────────────────────────────────────────────────────────

  it("lists blocked users (GET)", async () => {
    await POST(makeReq("POST", BASE, { blocker_id: "u1", blocked_id: "u2" }));
    await POST(makeReq("POST", BASE, { blocker_id: "u1", blocked_id: "u3" }));
    const res = await GET(makeReq("GET", `${BASE}?blocker_id=u1`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.blocked).toHaveLength(2);
  });

  it("400 GET without blocker_id", async () => {
    const res = await GET(makeReq("GET", BASE));
    expect(res.status).toBe(400);
  });

  // ── DELETE unblock ────────────────────────────────────────────────────────

  it("unblocks a user (DELETE)", async () => {
    await POST(makeReq("POST", BASE, { blocker_id: "u1", blocked_id: "u2" }));
    const res = await DELETE(makeReq("DELETE", `${BASE}?blocker_id=u1&blocked_id=u2`));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("404 DELETE on non-existent block", async () => {
    const res = await DELETE(makeReq("DELETE", `${BASE}?blocker_id=x&blocked_id=y`));
    expect(res.status).toBe(404);
  });

  // ── POST /check ───────────────────────────────────────────────────────────

  it("check returns none when no block exists", async () => {
    const res = await checkPOST(makeReq("POST", `${BASE}/check`, { a: "u1", b: "u2" }));
    const data = await res.json();
    expect(data.blocked).toBe(false);
    expect(data.direction).toBe("none");
  });

  it("check detects a_blocks_b direction", async () => {
    await POST(makeReq("POST", BASE, { blocker_id: "u1", blocked_id: "u2" }));
    const res = await checkPOST(makeReq("POST", `${BASE}/check`, { a: "u1", b: "u2" }));
    const data = await res.json();
    expect(data.blocked).toBe(true);
    expect(data.direction).toBe("a_blocks_b");
  });

  it("check detects b_blocks_a direction", async () => {
    await POST(makeReq("POST", BASE, { blocker_id: "u2", blocked_id: "u1" }));
    const res = await checkPOST(makeReq("POST", `${BASE}/check`, { a: "u1", b: "u2" }));
    const data = await res.json();
    expect(data.direction).toBe("b_blocks_a");
  });

  it("check detects both directions", async () => {
    await POST(makeReq("POST", BASE, { blocker_id: "u1", blocked_id: "u2" }));
    await POST(makeReq("POST", BASE, { blocker_id: "u2", blocked_id: "u1" }));
    const res = await checkPOST(makeReq("POST", `${BASE}/check`, { a: "u1", b: "u2" }));
    const data = await res.json();
    expect(data.direction).toBe("both");
  });
});
