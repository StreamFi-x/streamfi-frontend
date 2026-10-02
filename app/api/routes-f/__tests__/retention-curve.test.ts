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

describe("GET /api/routes-f/retention-curve — drop-off stream", () => {
  it("returns points array with expected shape", async () => {
    const res = await GET(makeGet("stream_drop"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.points)).toBe(true);
    expect(data.points.length).toBeGreaterThan(0);
    const first = data.points[0];
    expect(typeof first.minute).toBe("number");
    expect(typeof first.viewer_count).toBe("number");
    expect(typeof first.percent_of_peak).toBe("number");
  });

  it("first point has percent_of_peak of 100 (peak viewers at minute 0)", async () => {
    const res = await GET(makeGet("stream_drop"));
    const data = await res.json();
    expect(data.points[0].percent_of_peak).toBe(100);
  });

  it("percent_of_peak decreases over time for a drop-off stream", async () => {
    const res = await GET(makeGet("stream_drop"));
    const data = await res.json();
    const percents: number[] = data.points.map((p: { percent_of_peak: number }) => p.percent_of_peak);
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeLessThanOrEqual(percents[i - 1]);
    }
  });

  it("last point percent_of_peak is well below 50 for a strong drop-off", async () => {
    const res = await GET(makeGet("stream_drop"));
    const data = await res.json();
    const last = data.points[data.points.length - 1];
    expect(last.percent_of_peak).toBeLessThan(50);
  });
});
