/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, PATCH, DELETE, _resetStore } from "../route";

function makeReq(method: string, url: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "Content-Type": "application/json" },
  });
}

const BASE = "/api/routes-f/tip-goal-manage";
const FUTURE = "2099-12-31T00:00:00.000Z";

describe("Tip Goal Manage", () => {
  beforeEach(() => _resetStore());

  // ── POST ────────────────────────────────────────────────────────────────

  it("creates a goal (POST)", async () => {
    const res = await POST(makeReq("POST", BASE, {
      creator_id: "creator-1",
      goal_usdc: 100,
      title: "New PC",
      ends_at: FUTURE,
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.goal_id).toBeDefined();
    expect(data.created_at).toBeDefined();
  });

  it("400 when goal_usdc <= 0", async () => {
    const res = await POST(makeReq("POST", BASE, { creator_id: "c1", goal_usdc: 0 }));
    expect(res.status).toBe(400);
  });

  it("400 when ends_at is in the past", async () => {
    const res = await POST(makeReq("POST", BASE, {
      creator_id: "c1",
      goal_usdc: 50,
      ends_at: "2000-01-01T00:00:00.000Z",
    }));
    expect(res.status).toBe(400);
  });

  it("400 when creator_id is missing", async () => {
    const res = await POST(makeReq("POST", BASE, { goal_usdc: 50 }));
    expect(res.status).toBe(400);
  });

  // ── PATCH ───────────────────────────────────────────────────────────────

  it("updates title and goal_usdc (PATCH)", async () => {
    await POST(makeReq("POST", BASE, { creator_id: "creator-2", goal_usdc: 50 }));
    const res = await PATCH(makeReq("PATCH", BASE, {
      creator_id: "creator-2",
      goal_usdc: 200,
      title: "Upgraded goal",
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.goal_usdc).toBe(200);
    expect(data.title).toBe("Upgraded goal");
  });

  it("404 PATCH on non-existent goal", async () => {
    const res = await PATCH(makeReq("PATCH", BASE, { creator_id: "nobody", goal_usdc: 10 }));
    expect(res.status).toBe(404);
  });

  // ── DELETE ──────────────────────────────────────────────────────────────

  it("deletes a goal (DELETE)", async () => {
    await POST(makeReq("POST", BASE, { creator_id: "creator-3", goal_usdc: 75 }));
    const res = await DELETE(makeReq("DELETE", `${BASE}?creator_id=creator-3`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("404 DELETE on non-existent goal", async () => {
    const res = await DELETE(makeReq("DELETE", `${BASE}?creator_id=ghost`));
    expect(res.status).toBe(404);
  });

  // ── lifecycle ───────────────────────────────────────────────────────────

  it("full lifecycle: create -> patch -> delete", async () => {
    await POST(makeReq("POST", BASE, { creator_id: "lc", goal_usdc: 25 }));
    const patchRes = await PATCH(makeReq("PATCH", BASE, { creator_id: "lc", title: "Updated" }));
    expect((await patchRes.json()).title).toBe("Updated");
    const delRes = await DELETE(makeReq("DELETE", `${BASE}?creator_id=lc`));
    expect(delRes.status).toBe(200);
    // second delete should 404
    const del2 = await DELETE(makeReq("DELETE", `${BASE}?creator_id=lc`));
    expect(del2.status).toBe(404);
  });
});
