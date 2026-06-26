/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { attributeSources } from "../attribution";
import { sessionsForStream } from "../seed";
import type { SourceBreakdown } from "../types";

function makeReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/viewer-sources${query}`
  );
}

describe("attributeSources", () => {
  it("returns total equal to the session count", () => {
    const sessions = sessionsForStream("stream_1");
    const { total } = attributeSources(sessions);
    expect(total).toBe(sessions.length);
  });

  it("percentages sum to ~100 when there are sessions", () => {
    const { sources } = attributeSources(sessionsForStream("stream_1"));
    const sum = sources.reduce((acc, s) => acc + s.percent, 0);
    expect(Math.round(sum)).toBe(100);
  });

  it("computes correct viewer counts and percentages", () => {
    // stream_1: direct=2, explore=3, social=4, embed=1, total=10.
    const { sources, total } = attributeSources(sessionsForStream("stream_1"));
    expect(total).toBe(10);
    const social = sources.find(s => s.source === "social")!;
    expect(social.viewers).toBe(4);
    expect(social.percent).toBe(40);
    const embed = sources.find(s => s.source === "embed")!;
    expect(embed.percent).toBe(10);
  });

  it("sorts by viewers descending", () => {
    const { sources } = attributeSources(sessionsForStream("stream_1"));
    for (let i = 1; i < sources.length; i++) {
      expect(sources[i - 1].viewers).toBeGreaterThanOrEqual(sources[i].viewers);
    }
  });

  it("omits sources with no viewers (no zero-fill)", () => {
    // stream_2 has no embed traffic.
    const { sources } = attributeSources(sessionsForStream("stream_2"));
    expect(sources.find(s => s.source === "embed")).toBeUndefined();
  });

  it("rounds percentages to 2 decimals", () => {
    // stream_2: direct=1, social=2, explore=1, total=4.
    const { sources } = attributeSources(sessionsForStream("stream_2"));
    const direct = sources.find(s => s.source === "direct")!;
    expect(direct.percent).toBe(25);
    const social = sources.find(s => s.source === "social")!;
    expect(social.percent).toBe(50);
  });

  it("handles an empty session list", () => {
    const { sources, total } = attributeSources([]);
    expect(sources).toEqual<SourceBreakdown[]>([]);
    expect(total).toBe(0);
  });
});

describe("GET /api/routes-f/viewer-sources", () => {
  it("requires stream_id", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("stream_id");
  });

  it("returns the source breakdown and total", async () => {
    const res = await GET(makeReq("?stream_id=stream_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(10);
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.sources[0].source).toBe("social");
  });

  it("returns an empty breakdown for an unknown stream", async () => {
    const res = await GET(makeReq("?stream_id=ghost"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources).toEqual([]);
    expect(body.total).toBe(0);
  });
});
