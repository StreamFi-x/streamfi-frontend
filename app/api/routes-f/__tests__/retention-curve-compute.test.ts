/**
 * @jest-environment node
 */
import { normalizeRetention } from "../retention-curve/compute";

describe("normalizeRetention", () => {
  it("returns empty array for empty input", () => {
    expect(normalizeRetention([])).toEqual([]);
  });

  it("sets percent_of_peak to 100 for peak sample", () => {
    const result = normalizeRetention([
      { minute: 0, viewer_count: 1000 },
      { minute: 10, viewer_count: 500 },
    ]);
    expect(result[0].percent_of_peak).toBe(100);
  });

  it("correctly normalises to 50% at half peak", () => {
    const result = normalizeRetention([
      { minute: 0, viewer_count: 1000 },
      { minute: 10, viewer_count: 500 },
    ]);
    expect(result[1].percent_of_peak).toBe(50);
  });

  it("returns percent_of_peak rounded to 2 decimal places", () => {
    const result = normalizeRetention([
      { minute: 0, viewer_count: 3 },
      { minute: 1, viewer_count: 1 },
    ]);
    expect(result[1].percent_of_peak).toBe(33.33);
  });

  it("preserves minute and viewer_count fields unchanged", () => {
    const result = normalizeRetention([{ minute: 5, viewer_count: 200 }]);
    expect(result[0].minute).toBe(5);
    expect(result[0].viewer_count).toBe(200);
  });

  it("returns 0 percent_of_peak for all samples when peak is 0", () => {
    const result = normalizeRetention([
      { minute: 0, viewer_count: 0 },
      { minute: 1, viewer_count: 0 },
    ]);
    for (const p of result) {
      expect(p.percent_of_peak).toBe(0);
    }
  });
});
