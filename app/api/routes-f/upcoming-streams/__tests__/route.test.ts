/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { getScheduledStreams } from "../seed";

function makeReq(query = ""): NextRequest {
  const url = `http://localhost/api/routes-f/upcoming-streams${query}`;
  return new NextRequest(url);
}

describe("GET /api/routes-f/upcoming-streams", () => {
  describe("Validation", () => {
    it("rejects non-numeric within_hours", async () => {
      const res = await GET(makeReq("?within_hours=soon"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("within_hours");
    });

    it("rejects zero within_hours", async () => {
      const res = await GET(makeReq("?within_hours=0"));
      expect(res.status).toBe(400);
    });

    it("rejects negative within_hours", async () => {
      const res = await GET(makeReq("?within_hours=-5"));
      expect(res.status).toBe(400);
    });

    it("rejects within_hours over the maximum", async () => {
      const res = await GET(makeReq("?within_hours=100000"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("at most");
    });
  });

  describe("Default time window", () => {
    it("defaults to a 48-hour window", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(200);
      const body = await res.json();

      const now = Date.now();
      const windowEnd = now + 48 * 60 * 60 * 1000;
      body.scheduled.forEach((s: { starts_at: string }) => {
        const t = new Date(s.starts_at).getTime();
        expect(t).toBeGreaterThan(now);
        expect(t).toBeLessThanOrEqual(windowEnd + 1000);
      });
    });

    it("excludes streams that already started (stale schedule)", async () => {
      const res = await GET(makeReq());
      const body = await res.json();
      const ids = body.scheduled.map((s: { stream_id: string }) => s.stream_id);
      expect(ids).not.toContain("sched_009");
    });
  });

  describe("Time window filtering", () => {
    it("a narrow window returns fewer results than a wide one", async () => {
      const narrow = await (await GET(makeReq("?within_hours=3"))).json();
      const wide = await (await GET(makeReq("?within_hours=168"))).json();
      expect(wide.scheduled.length).toBeGreaterThan(narrow.scheduled.length);
    });

    it("a 3-hour window only includes the soonest stream", async () => {
      const res = await GET(makeReq("?within_hours=3"));
      const body = await res.json();
      const ids = body.scheduled.map((s: { stream_id: string }) => s.stream_id);
      expect(ids).toEqual(["sched_001"]);
    });

    it("widening the window includes streams further out", async () => {
      const res = await GET(makeReq("?within_hours=48"));
      const body = await res.json();
      const ids = body.scheduled.map((s: { stream_id: string }) => s.stream_id);
      expect(ids).toContain("sched_006"); // 47h out
      expect(ids).not.toContain("sched_007"); // 72h out
    });
  });

  describe("Category filtering", () => {
    it("filters to a single category", async () => {
      const res = await GET(makeReq("?within_hours=168&category=gaming"));
      const body = await res.json();
      expect(body.scheduled.length).toBeGreaterThan(0);
      body.scheduled.forEach((s: { category: string }) => {
        expect(s.category).toBe("gaming");
      });
    });

    it("category matching is case-insensitive", async () => {
      const lower = await (
        await GET(makeReq("?within_hours=168&category=crypto"))
      ).json();
      const upper = await (
        await GET(makeReq("?within_hours=168&category=CRYPTO"))
      ).json();
      expect(upper.scheduled.map((s: { stream_id: string }) => s.stream_id)).toEqual(
        lower.scheduled.map((s: { stream_id: string }) => s.stream_id)
      );
    });

    it("returns empty for an unknown category", async () => {
      const res = await GET(makeReq("?within_hours=168&category=underwater-basket"));
      const body = await res.json();
      expect(body.scheduled).toEqual([]);
    });

    it("combines category and time window", async () => {
      const res = await GET(makeReq("?within_hours=48&category=music"));
      const body = await res.json();
      const ids = body.scheduled.map((s: { stream_id: string }) => s.stream_id);
      expect(ids).toContain("sched_003"); // music, 12h
      expect(ids).not.toContain("sched_008"); // music, 96h (outside window)
    });
  });

  describe("Sorting", () => {
    it("sorts by starts_at ascending", async () => {
      const res = await GET(makeReq("?within_hours=336"));
      const body = await res.json();
      for (let i = 1; i < body.scheduled.length; i++) {
        const prev = new Date(body.scheduled[i - 1].starts_at).getTime();
        const cur = new Date(body.scheduled[i].starts_at).getTime();
        expect(prev).toBeLessThanOrEqual(cur);
      }
    });
  });

  describe("Response shape", () => {
    it("returns scheduled streams with the expected fields", async () => {
      const res = await GET(makeReq("?within_hours=336"));
      const body = await res.json();
      expect(Array.isArray(body.scheduled)).toBe(true);
      body.scheduled.forEach((s: Record<string, unknown>) => {
        expect(s).toHaveProperty("stream_id");
        expect(s).toHaveProperty("creator_id");
        expect(s).toHaveProperty("creator_name");
        expect(s).toHaveProperty("title");
        expect(s).toHaveProperty("category");
        expect(s).toHaveProperty("privacy");
        expect(s).toHaveProperty("starts_at");
        expect(s).toHaveProperty("thumbnail_url");
      });
    });
  });

  describe("Seed data", () => {
    it("produces ISO timestamps relative to the reference time", () => {
      const base = 1_700_000_000_000;
      const streams = getScheduledStreams(base);
      const first = streams.find(s => s.stream_id === "sched_001")!;
      expect(new Date(first.starts_at).getTime()).toBe(base + 2 * 60 * 60 * 1000);
    });

    it("includes a stale (past) entry in the raw seed", () => {
      const base = 1_700_000_000_000;
      const streams = getScheduledStreams(base);
      const stale = streams.find(s => s.stream_id === "sched_009")!;
      expect(new Date(stale.starts_at).getTime()).toBeLessThan(base);
    });
  });
});
