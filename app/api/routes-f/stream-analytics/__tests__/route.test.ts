/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { summarizeSession } from "../summarize";
import { getSession } from "../seed";

function makeReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/stream-analytics${query}`
  );
}

describe("summarizeSession", () => {
  it("computes a completed stream's fixed duration", () => {
    const session = getSession("stream_completed_1")!;
    const summary = summarizeSession(session);
    expect(summary.duration_minutes).toBe(120);
  });

  it("computes peak and average viewers from samples", () => {
    const session = getSession("stream_completed_1")!;
    const summary = summarizeSession(session);
    // samples: [120,340,510,480,620,590,410,250]
    expect(summary.peak_viewers).toBe(620);
    expect(summary.average_viewers).toBe(403); // mean 3220/8 = 402.5 -> 403
  });

  it("counts unique viewers and messages", () => {
    const session = getSession("stream_completed_1")!;
    const summary = summarizeSession(session);
    expect(summary.unique_viewers).toBe(12);
    expect(summary.total_messages).toBe(1843);
  });

  it("sums tips in USDC", () => {
    const session = getSession("stream_completed_1")!;
    const summary = summarizeSession(session);
    // 5+10+25+2.5+100+50+7.5+15 = 215
    expect(summary.total_tips_usdc).toBe(215);
  });

  it("handles a completed stream with no tips", () => {
    const session = getSession("stream_completed_2")!;
    const summary = summarizeSession(session);
    expect(summary.duration_minutes).toBe(45);
    expect(summary.total_tips_usdc).toBe(0);
    expect(summary.peak_viewers).toBe(42);
    expect(summary.average_viewers).toBe(42);
  });

  it("computes a live stream's duration relative to now", () => {
    const now = Date.parse("2026-06-26T10:00:00.000Z");
    const session = getSession("stream_live_1", now)!;
    const summary = summarizeSession(session, now);
    // seed starts the live stream 35 minutes before `now`.
    expect(summary.duration_minutes).toBe(35);
  });

  it("a live stream's duration grows as now advances", () => {
    const base = Date.parse("2026-06-26T10:00:00.000Z");
    const session = getSession("stream_live_1", base)!;
    const early = summarizeSession(session, base);
    const later = summarizeSession(session, base + 10 * 60 * 1000);
    expect(later.duration_minutes).toBeGreaterThan(early.duration_minutes);
  });
});

describe("GET /api/routes-f/stream-analytics", () => {
  it("requires stream_id", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("stream_id");
  });

  it("404s for an unknown stream", async () => {
    const res = await GET(makeReq("?stream_id=nope"));
    expect(res.status).toBe(404);
  });

  it("returns a summary for a completed stream", async () => {
    const res = await GET(makeReq("?stream_id=stream_completed_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      duration_minutes: 120,
      peak_viewers: 620,
      average_viewers: 403,
      unique_viewers: 12,
      total_messages: 1843,
      total_tips_usdc: 215,
    });
  });

  it("returns a summary for a live (in-progress) stream", async () => {
    const res = await GET(makeReq("?stream_id=stream_live_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.peak_viewers).toBe(410);
    expect(body.unique_viewers).toBe(7);
    expect(body.total_messages).toBe(512);
    expect(body.total_tips_usdc).toBe(63.5);
    // Live duration should be roughly the seed's 35-minute offset.
    expect(body.duration_minutes).toBeGreaterThanOrEqual(34);
    expect(body.duration_minutes).toBeLessThanOrEqual(36);
  });

  it("returns all required fields", async () => {
    const res = await GET(makeReq("?stream_id=stream_completed_1"));
    const body = await res.json();
    [
      "duration_minutes",
      "peak_viewers",
      "average_viewers",
      "unique_viewers",
      "total_messages",
      "total_tips_usdc",
    ].forEach(key => expect(body).toHaveProperty(key));
  });
});
