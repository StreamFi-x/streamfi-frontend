/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, goals, tipRecords } from "../route";

function makeGet(creator_id?: string) {
  const url = creator_id
    ? `http://localhost/api/routes-f/tip-goal?creator_id=${creator_id}`
    : "http://localhost/api/routes-f/tip-goal";
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/routes-f/tip-goal", () => {
  // Restore seed data after tests that mutate the maps
  afterEach(() => {
    goals.set("creator-alpha", {
      creator_id: "creator-alpha",
      goal_usdc: 100,
      ends_at: "2099-12-31T00:00:00.000Z",
    });
    tipRecords.set("creator-alpha", [
      { viewer_id: "viewer-1", amount_usdc: 30, tipped_at: "2026-06-01T10:00:00.000Z" },
      { viewer_id: "viewer-2", amount_usdc: 25, tipped_at: "2026-06-02T11:00:00.000Z" },
      { viewer_id: "viewer-1", amount_usdc: 10, tipped_at: "2026-06-03T12:00:00.000Z" },
    ]);
    goals.set("creator-beta", { creator_id: "creator-beta", goal_usdc: 50 });
    tipRecords.set("creator-beta", [
      { viewer_id: "viewer-3", amount_usdc: 50, tipped_at: "2026-06-01T09:00:00.000Z" },
    ]);
  });

  // ── under-goal ────────────────────────────────────────────────────────────

  it("returns under-goal progress correctly", async () => {
    // creator-alpha: 30 + 25 + 10 = 65 of 100 → 65%
    const res = await GET(makeGet("creator-alpha"));
    expect(res.status).toBe(200);
    const { goal } = await res.json();
    expect(goal).not.toBeNull();
    expect(goal.goal_usdc).toBe(100);
    expect(goal.current_usdc).toBe(65);
    expect(goal.percent).toBe(65);
    expect(goal.contributors).toBe(2); // viewer-1 and viewer-2 (unique)
    expect(goal.ends_at).toBe("2099-12-31T00:00:00.000Z");
  });

  // ── exactly-goal ──────────────────────────────────────────────────────────

  it("returns 100% when tips exactly meet the goal", async () => {
    // creator-beta: 50 of 50 → 100%
    const res = await GET(makeGet("creator-beta"));
    const { goal } = await res.json();
    expect(goal.current_usdc).toBe(50);
    expect(goal.percent).toBe(100);
    expect(goal.ends_at).toBeUndefined();
  });

  // ── over-goal ─────────────────────────────────────────────────────────────

  it("caps percent at 100 when tips exceed the goal", async () => {
    tipRecords.set("creator-beta", [
      { viewer_id: "viewer-3", amount_usdc: 75, tipped_at: "2026-06-01T09:00:00.000Z" },
    ]);
    const res = await GET(makeGet("creator-beta"));
    const { goal } = await res.json();
    expect(goal.current_usdc).toBe(75);
    expect(goal.percent).toBe(100);
  });

  // ── no active goal ────────────────────────────────────────────────────────

  it("returns null when creator has no goal", async () => {
    const res = await GET(makeGet("creator-unknown"));
    expect(res.status).toBe(200);
    const { goal } = await res.json();
    expect(goal).toBeNull();
  });

  it("returns null when goal has expired", async () => {
    goals.set("creator-expired", {
      creator_id: "creator-expired",
      goal_usdc: 100,
      ends_at: "2000-01-01T00:00:00.000Z",
    });
    const res = await GET(makeGet("creator-expired"));
    const { goal } = await res.json();
    expect(goal).toBeNull();
    // cleanup
    goals.delete("creator-expired");
  });

  // ── contributors ──────────────────────────────────────────────────────────

  it("counts unique contributors", async () => {
    tipRecords.set("creator-alpha", [
      { viewer_id: "v1", amount_usdc: 10, tipped_at: "2026-01-01T00:00:00.000Z" },
      { viewer_id: "v1", amount_usdc: 10, tipped_at: "2026-01-02T00:00:00.000Z" },
      { viewer_id: "v2", amount_usdc: 10, tipped_at: "2026-01-03T00:00:00.000Z" },
    ]);
    const res = await GET(makeGet("creator-alpha"));
    const { goal } = await res.json();
    expect(goal.contributors).toBe(2);
  });

  // ── validation ────────────────────────────────────────────────────────────

  it("400 when creator_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });
});
