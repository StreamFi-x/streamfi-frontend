/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { POST } from "../increment/route";
import { giftCounts, computeProgress, MILESTONES } from "../store";

function makeGet(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/gift-sub-progress${query}`);
}
function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/gift-sub-progress/increment",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
}

beforeEach(() => {
  giftCounts.set("stream-gs-1", 7);
  giftCounts.set("stream-gs-2", 0);
  giftCounts.set("stream-gs-3", 100);
});

// ── computeProgress ──────────────────────────────────────────────────────────

describe("computeProgress", () => {
  it("returns null milestones and 0 percent at count=0", () => {
    const p = computeProgress(0);
    expect(p.current_milestone).toBeNull();
    expect(p.next_milestone).toBe(MILESTONES[0]);
    expect(p.percent_to_next).toBe(0);
  });

  it("recognizes milestone crossing at each tier", () => {
    for (const m of MILESTONES) {
      const p = computeProgress(m);
      expect(p.current_milestone).toBe(m);
    }
  });

  it("computes partial progress between milestones", () => {
    // Between 5 and 10 (distance=5): at 7 → (7-5)/(10-5) = 40%
    const p = computeProgress(7);
    expect(p.current_milestone).toBe(5);
    expect(p.next_milestone).toBe(10);
    expect(p.percent_to_next).toBeCloseTo(40, 1);
  });

  it("returns 100% when all milestones are reached", () => {
    const p = computeProgress(100);
    expect(p.current_milestone).toBe(100);
    expect(p.next_milestone).toBeNull();
    expect(p.percent_to_next).toBe(100);
  });
});

// ── GET ──────────────────────────────────────────────────────────────────────

describe("GET /gift-sub-progress", () => {
  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown stream", async () => {
    const res = await GET(makeGet("?stream_id=nope"));
    expect(res.status).toBe(404);
  });

  it("returns progress for stream-gs-1 (count=7, milestone=5)", async () => {
    const res = await GET(makeGet("?stream_id=stream-gs-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gifts_received).toBe(7);
    expect(body.current_milestone).toBe(5);
    expect(body.next_milestone).toBe(10);
    expect(body.percent_to_next).toBeCloseTo(40, 1);
  });

  it("returns all-null progress for a stream at zero gifts", async () => {
    const res = await GET(makeGet("?stream_id=stream-gs-2"));
    const body = await res.json();
    expect(body.current_milestone).toBeNull();
    expect(body.gifts_received).toBe(0);
  });
});

// ── POST /increment ──────────────────────────────────────────────────────────

describe("POST /increment", () => {
  it("returns 400 when stream_id is missing", async () => {
    const res = await POST(makePost({ by: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown stream", async () => {
    const res = await POST(makePost({ stream_id: "nope", by: 1 }));
    expect(res.status).toBe(404);
  });

  it("defaults to incrementing by 1", async () => {
    const res = await POST(makePost({ stream_id: "stream-gs-1" }));
    const body = await res.json();
    expect(body.gifts_received).toBe(8);
  });

  it("increments by a custom amount", async () => {
    const res = await POST(makePost({ stream_id: "stream-gs-2", by: 5 }));
    const body = await res.json();
    expect(body.gifts_received).toBe(5);
    expect(body.current_milestone).toBe(5);
    expect(body.next_milestone).toBe(10);
  });

  it("crosses a milestone after enough increments", async () => {
    // stream-gs-1 starts at 7 (milestone=5); +4 should cross 10
    await POST(makePost({ stream_id: "stream-gs-1", by: 3 }));
    const res = await POST(makePost({ stream_id: "stream-gs-1" }));
    const body = await res.json();
    expect(body.gifts_received).toBe(11);
    expect(body.current_milestone).toBe(10);
    expect(body.next_milestone).toBe(25);
  });

  it("clamps non-integer or negative by to 1", async () => {
    const res = await POST(makePost({ stream_id: "stream-gs-2", by: -5 }));
    const body = await res.json();
    expect(body.gifts_received).toBe(1);
  });
});
