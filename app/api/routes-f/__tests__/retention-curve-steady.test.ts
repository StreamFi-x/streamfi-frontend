/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../retention-curve/route";

function makeGet(streamId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/retention-curve?stream_id=${streamId}`
  );
}

describe("GET /api/routes-f/retention-curve — steady stream", () => {
  it("all points stay above 90% for a steady stream", async () => {
    const res = await GET(makeGet("stream_steady"));
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const point of data.points) {
      expect(point.percent_of_peak).toBeGreaterThanOrEqual(90);
    }
  });

  it("first point is 100% for steady stream", async () => {
    const res = await GET(makeGet("stream_steady"));
    const data = await res.json();
    expect(data.points[0].percent_of_peak).toBe(100);
  });
});

describe("GET /api/routes-f/retention-curve — edge cases", () => {
  it("returns 404 for unknown stream_id", async () => {
    const res = await GET(makeGet("stream_unknown"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/routes-f/retention-curve")
    );
    expect(res.status).toBe(400);
  });

  it("handles single-sample stream without dividing by zero", async () => {
    const res = await GET(makeGet("stream_single"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.points).toHaveLength(1);
    expect(data.points[0].percent_of_peak).toBe(100);
    expect(data.points[0].viewer_count).toBe(500);
  });
});
