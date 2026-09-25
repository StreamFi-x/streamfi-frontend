/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";
import { scoreWindows, pickTopHighlights } from "../highlights";
import { getStream } from "../seed";
import type { StreamSample } from "../types";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/highlight-reel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("scoreWindows", () => {
  it("scores zero for an empty stream", () => {
    const empty: StreamSample = {
      stream_id: "empty",
      duration_seconds: 120,
      chat_events: [],
      tip_events: [],
    };
    expect(scoreWindows(empty)).toHaveLength(0);
  });

  it("weights tips higher than chat messages", () => {
    const stream: StreamSample = {
      stream_id: "test",
      duration_seconds: 60,
      chat_events: [{ offset_seconds: 5 }],
      tip_events: [{ offset_seconds: 5, amount_usdc: 10 }],
    };
    const windows = scoreWindows(stream);
    expect(windows[0].score).toBeGreaterThan(windows[0].chat_count);
  });
});

describe("pickTopHighlights with known spike in stream-hl-1", () => {
  const stream = getStream("stream-hl-1")!;

  it("returns at most 5 highlights", () => {
    const highlights = pickTopHighlights(stream);
    expect(highlights.length).toBeLessThanOrEqual(5);
  });

  it("all windows are 30 seconds wide", () => {
    const highlights = pickTopHighlights(stream);
    for (const h of highlights) {
      expect(h.end_seconds - h.start_seconds).toBe(30);
    }
  });

  it("highest-scored window covers the 60-90s chat+tip spike", () => {
    const highlights = pickTopHighlights(stream);
    const topByScore = [...highlights].sort((a, b) => b.score - a.score)[0];
    // The dense chat+tip cluster at 62-90s should be in the top window
    expect(topByScore.start_seconds).toBeLessThanOrEqual(65);
    expect(topByScore.end_seconds).toBeGreaterThanOrEqual(90);
  });

  it("selected windows do not overlap", () => {
    const highlights = pickTopHighlights(stream);
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
    const highlights = pickTopHighlights(stream);
    const valid = new Set(["chat burst", "tip spike", "chat and tip spike"]);
    for (const h of highlights) {
      expect(valid.has(h.reason)).toBe(true);
    }
  });
});

describe("POST /api/routes-f/highlight-reel", () => {
  it("returns 400 when stream_id is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown stream", async () => {
    const res = await POST(makeReq({ stream_id: "nope" }));
    expect(res.status).toBe(404);
  });

  it("returns highlights array for a known stream", async () => {
    const res = await POST(makeReq({ stream_id: "stream-hl-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stream_id).toBe("stream-hl-1");
    expect(Array.isArray(body.highlights)).toBe(true);
    expect(body.highlights.length).toBeGreaterThan(0);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/highlight-reel", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
