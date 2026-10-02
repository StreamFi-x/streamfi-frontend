/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { scoreWindows, detectHighlights } from "../highlights";
import { getLastSessionForCreator } from "../seed";
import type { LastSession } from "../types";

function makeReq(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/stream-highlight-reel${query}`);
}

describe("scoreWindows", () => {
  it("scores zero windows for a session with no activity", () => {
    const empty: LastSession = {
      creator_id: "c-empty",
      stream_id: "s-empty",
      ended_at: "2026-01-01T00:00:00.000Z",
      duration_seconds: 120,
      chat_events: [],
      tip_events: [],
    };
    expect(scoreWindows(empty)).toHaveLength(0);
  });

  it("weights tips higher than chat messages", () => {
    const session: LastSession = {
      creator_id: "c-test",
      stream_id: "s-test",
      ended_at: "2026-01-01T00:00:00.000Z",
      duration_seconds: 60,
      chat_events: [{ offset_seconds: 5 }],
      tip_events: [{ offset_seconds: 5, amount_usdc: 10 }],
    };
    const windows = scoreWindows(session);
    expect(windows[0].score).toBeGreaterThan(windows[0].chat_count);
  });
});

describe("detectHighlights for creator-001's last session", () => {
  const session = getLastSessionForCreator("creator-001")!;

  it("returns at most 5 highlights", () => {
    const highlights = detectHighlights(session);
    expect(highlights.length).toBeLessThanOrEqual(5);
  });

  it("all windows are 30 seconds wide", () => {
    const highlights = detectHighlights(session);
    for (const h of highlights) {
      expect(h.end_seconds - h.start_seconds).toBe(30);
    }
  });

  it("selected windows do not overlap", () => {
    const highlights = detectHighlights(session);
    for (let i = 0; i < highlights.length - 1; i++) {
      for (let j = i + 1; j < highlights.length; j++) {
        const a = highlights[i];
        const b = highlights[j];
        const overlap = a.start_seconds < b.end_seconds && b.start_seconds < a.end_seconds;
        expect(overlap).toBe(false);
      }
    }
  });

  it("reasons are one of the expected labels", () => {
    const highlights = detectHighlights(session);
    const valid = new Set(["chat burst", "tip spike", "chat and tip spike"]);
    for (const h of highlights) {
      expect(valid.has(h.reason)).toBe(true);
    }
  });
});

describe("GET /api/routes-f/stream-highlight-reel", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown creator_id", async () => {
    const res = await GET(makeReq("?creator_id=nope"));
    expect(res.status).toBe(404);
  });

  it("returns highlights for a creator with activity", async () => {
    const res = await GET(makeReq("?creator_id=creator-001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creator_id).toBe("creator-001");
    expect(body.stream_id).toBe("stream-hl-1");
    expect(Array.isArray(body.highlights)).toBe(true);
    expect(body.highlights.length).toBeGreaterThan(0);
  });

  it("returns an empty highlights array for a session with no activity", async () => {
    const res = await GET(makeReq("?creator_id=creator-003"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.highlights).toEqual([]);
  });
});
