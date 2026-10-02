/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { computePeak, getTopPeaks } from "../peaks";
import { getSessionsForCreator } from "../seed";

function makeReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/viewer-peaks${query}`
  );
}

describe("computePeak", () => {
  it("finds the max viewer sample and its timestamp", () => {
    const session = getSessionsForCreator("creator_a")[0];
    const peak = computePeak(session);
    expect(peak.peak_viewers).toBe(620);
    expect(peak.peaked_at).toBe("2026-06-20T19:00:00.000Z");
    expect(peak.title).toBe("Stellar DeFi Deep Dive");
  });
});

describe("getTopPeaks", () => {
  it("sorts peaks by peak_viewers descending", () => {
    const sessions = getSessionsForCreator("creator_a");
    const peaks = getTopPeaks(sessions, 10);
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i - 1].peak_viewers).toBeGreaterThanOrEqual(
        peaks[i].peak_viewers
      );
    }
  });

  it("respects the limit", () => {
    const sessions = getSessionsForCreator("creator_a");
    const peaks = getTopPeaks(sessions, 2);
    expect(peaks).toHaveLength(2);
    expect(peaks[0].peak_viewers).toBe(620);
    expect(peaks[1].peak_viewers).toBe(450);
  });
});

describe("GET /api/routes-f/viewer-peaks", () => {
  it("requires creator_id", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("creator_id");
  });

  it("rejects invalid limit", async () => {
    const res = await GET(makeReq("?creator_id=creator_a&limit=0"));
    expect(res.status).toBe(400);
  });

  it("returns peaks sorted by peak_viewers desc with default limit", async () => {
    const res = await GET(makeReq("?creator_id=creator_a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.peaks.length).toBeGreaterThan(0);
    expect(body.peaks[0]).toMatchObject({
      stream_id: expect.any(String),
      peak_viewers: expect.any(Number),
      peaked_at: expect.any(String),
      title: expect.any(String),
    });
    expect(body.peaks[0].peak_viewers).toBe(620);
    expect(body.peaks[1].peak_viewers).toBe(450);
  });

  it("honors a custom limit", async () => {
    const res = await GET(makeReq("?creator_id=creator_a&limit=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.peaks).toHaveLength(1);
    expect(body.peaks[0].peak_viewers).toBe(620);
  });

  it("returns an empty list for an unknown creator", async () => {
    const res = await GET(makeReq("?creator_id=unknown"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.peaks).toEqual([]);
  });
});
