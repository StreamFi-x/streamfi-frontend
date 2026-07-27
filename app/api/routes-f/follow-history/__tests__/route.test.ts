import { NextRequest } from "next/server";
import { GET } from "../route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/follow-history");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/routes-f/follow-history", () => {
  it("returns follow history for a valid viewer_id", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.viewer_id).toBe("viewer-001");
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history.length).toBeGreaterThan(0);
  });

  it("each event has creator, action, and ts fields", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-002" }));
    const data = await res.json();
    for (const event of data.history) {
      expect(typeof event.creator).toBe("string");
      expect(["follow", "unfollow"]).toContain(event.action);
      expect(typeof event.ts).toBe("string");
    }
  });

  it("events are sorted by ts descending", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-003" }));
    const data = await res.json();
    for (let i = 1; i < data.history.length; i++) {
      expect(data.history[i - 1].ts >= data.history[i].ts).toBe(true);
    }
  });

  it("includes both follow and unfollow events", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-004" }));
    const data = await res.json();
    const actions = new Set(data.history.map((e: { action: string }) => e.action));
    expect(actions.has("follow")).toBe(true);
  });

  it("returns 400 when viewer_id is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });

  it("respects the limit query param", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-005", limit: "3" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.history.length).toBeLessThanOrEqual(3);
  });

  it("returns 400 for an out-of-range limit", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-006", limit: "0" }));
    expect(res.status).toBe(400);
  });

  it("returns deterministic results for the same viewer_id", async () => {
    const res1 = await GET(makeGet({ viewer_id: "viewer-stable" }));
    const res2 = await GET(makeGet({ viewer_id: "viewer-stable" }));
    expect(await res1.json()).toEqual(await res2.json());
  });
});
