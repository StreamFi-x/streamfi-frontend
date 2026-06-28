/**
 * Tests for app/api/routes-f/viewing-streak/
 * Covers: GET streak, POST check-in (extend, reset, duplicate)
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { POST } from "../check-in/route";
import { streakStore, storeKey } from "../store";

function makeGetReq(viewer_id: string, creator_id: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/viewing-streak?viewer_id=${viewer_id}&creator_id=${creator_id}`
  );
}

function makeCheckIn(body: unknown) {
  return new NextRequest(
    `http://localhost/api/routes-f/viewing-streak/check-in`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

beforeEach(() => {
  delete streakStore[storeKey("viewer_test", "creator_test")];
});

describe("GET /api/routes-f/viewing-streak", () => {
  it("returns 400 when params are missing", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/viewing-streak");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown pair", async () => {
    const res = await GET(makeGetReq("unknown_viewer", "unknown_creator"));
    expect(res.status).toBe(404);
  });

  it("returns streak for known pair", async () => {
    const res = await GET(makeGetReq("viewer_jane", "creator_alice"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.current_streak).toBeGreaterThan(0);
    expect(body.longest_streak).toBeGreaterThanOrEqual(body.current_streak);
  });
});

describe("POST /api/routes-f/viewing-streak/check-in", () => {
  it("starts a new streak on first check-in", async () => {
    const res = await POST(
      makeCheckIn({
        viewer_id: "viewer_test",
        creator_id: "creator_test",
        on_date: "2026-06-01",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.current_streak).toBe(1);
    expect(body.longest_streak).toBe(1);
  });

  it("extends streak on consecutive day", async () => {
    streakStore[storeKey("viewer_test", "creator_test")] = {
      viewer_id: "viewer_test",
      creator_id: "creator_test",
      current_streak: 3,
      longest_streak: 5,
      last_check_in: "2026-06-10",
    };

    const res = await POST(
      makeCheckIn({
        viewer_id: "viewer_test",
        creator_id: "creator_test",
        on_date: "2026-06-11",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.current_streak).toBe(4);
    expect(body.longest_streak).toBe(5); // still old record
  });

  it("resets streak when gap > 1 day", async () => {
    streakStore[storeKey("viewer_test", "creator_test")] = {
      viewer_id: "viewer_test",
      creator_id: "creator_test",
      current_streak: 10,
      longest_streak: 10,
      last_check_in: "2026-06-05",
    };

    const res = await POST(
      makeCheckIn({
        viewer_id: "viewer_test",
        creator_id: "creator_test",
        on_date: "2026-06-10",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.current_streak).toBe(1);
    expect(body.longest_streak).toBe(10); // preserved
  });

  it("does not double-count same-day check-in", async () => {
    streakStore[storeKey("viewer_test", "creator_test")] = {
      viewer_id: "viewer_test",
      creator_id: "creator_test",
      current_streak: 3,
      longest_streak: 3,
      last_check_in: "2026-06-11",
    };

    const res = await POST(
      makeCheckIn({
        viewer_id: "viewer_test",
        creator_id: "creator_test",
        on_date: "2026-06-11",
      })
    );
    const body = await res.json();
    expect(body.current_streak).toBe(3); // unchanged
  });
});
