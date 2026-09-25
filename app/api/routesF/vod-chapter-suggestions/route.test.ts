import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/vod-chapter-suggestions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("VOD Chapter Suggestions API", () => {
  it("returns suggestions with required fields", async () => {
    const res = await POST(makeReq({ vod_id: "vod-001" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.vod_id).toBe("vod-001");
    expect(typeof data.duration_seconds).toBe("number");
    expect(Array.isArray(data.suggestions)).toBe(true);
  });

  it("returns at most 5 suggestions", async () => {
    const res = await POST(makeReq({ vod_id: "vod-002" }));
    const data = await res.json();

    expect(data.suggestions.length).toBeLessThanOrEqual(5);
  });

  it("each suggestion has required fields", async () => {
    const res = await POST(makeReq({ vod_id: "vod-003" }));
    const data = await res.json();

    for (const s of data.suggestions) {
      expect(s).toHaveProperty("start_seconds");
      expect(s).toHaveProperty("end_seconds");
      expect(s).toHaveProperty("title");
      expect(s).toHaveProperty("confidence");
    }
  });

  it("chapters are non-overlapping — each start >= previous end", async () => {
    const res = await POST(makeReq({ vod_id: "vod-004", duration_seconds: 7200 }));
    const data = await res.json();

    for (let i = 1; i < data.suggestions.length; i++) {
      expect(data.suggestions[i].start_seconds).toBeGreaterThanOrEqual(
        data.suggestions[i - 1].end_seconds
      );
    }
  });

  it("chapters cover the entire VOD duration", async () => {
    const duration = 3600;
    const res = await POST(makeReq({ vod_id: "vod-005", duration_seconds: duration }));
    const data = await res.json();

    const first = data.suggestions[0];
    const last = data.suggestions[data.suggestions.length - 1];
    expect(first.start_seconds).toBe(0);
    expect(last.end_seconds).toBe(duration);
  });

  it("start_seconds < end_seconds for every chapter", async () => {
    const res = await POST(makeReq({ vod_id: "vod-006" }));
    const data = await res.json();

    for (const s of data.suggestions) {
      expect(s.start_seconds).toBeLessThan(s.end_seconds);
    }
  });

  it("confidence is between 0 and 1", async () => {
    const res = await POST(makeReq({ vod_id: "vod-007" }));
    const data = await res.json();

    for (const s of data.suggestions) {
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("uses default duration of 3600 when omitted", async () => {
    const res = await POST(makeReq({ vod_id: "vod-008" }));
    const data = await res.json();

    expect(data.duration_seconds).toBe(3600);
  });

  it("accepts custom duration_seconds", async () => {
    const res = await POST(makeReq({ vod_id: "vod-009", duration_seconds: 5400 }));
    const data = await res.json();

    expect(data.duration_seconds).toBe(5400);
  });

  it("returns 400 when vod_id is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routesF/vod-chapter-suggestions", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("different vod_ids produce deterministic but distinct results", async () => {
    const res1 = await POST(makeReq({ vod_id: "vod-aaa" }));
    const res2 = await POST(makeReq({ vod_id: "vod-bbb" }));

    const data1 = await res1.json();
    const data2 = await res2.json();

    const titlesMatch = data1.suggestions[0].title === data2.suggestions[0].title &&
      data1.suggestions[1].title === data2.suggestions[1].title;
    expect(titlesMatch).toBe(false);
  });
});
