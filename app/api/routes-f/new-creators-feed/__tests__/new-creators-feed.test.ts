import { NextRequest } from "next/server";
import { GET } from "../route";
import * as helpers from "../helpers";
import type { NewCreator } from "../types";

const BASE_URL = "http://localhost/api/routes-f/new-creators-feed";

function makeGet(params: Record<string, string> = {}) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: "GET" });
}

// Tests
describe("GET /api/routes-f/new-creators-feed", () => {
  // default params (within_days=7, min_streams=1)

  it("returns 200 with default within_days=7 and min_streams=1", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.within_days).toBe(7);
    expect(body.min_streams).toBe(1);
    expect(Array.isArray(body.creators)).toBe(true);
  });

  it("returns creators sorted by joined_at descending", async () => {
    const res = await GET(makeGet({ within_days: "30" }));
    const { creators } = await res.json();
    for (let i = 1; i < creators.length; i++) {
      expect(
        new Date(creators[i - 1].joined_at).getTime()
      ).toBeGreaterThanOrEqual(new Date(creators[i].joined_at).getTime());
    }
  });

  // varied windows

  it("within_days=3 returns only creators who joined ≤ 3 days ago", async () => {
    const res = await GET(makeGet({ within_days: "3" }));
    const { creators } = await res.json();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);
    for (const c of creators) {
      expect(new Date(c.joined_at).getTime()).toBeGreaterThanOrEqual(
        cutoff.getTime() - 1000 // 1 s tolerance for test execution
      );
    }
  });

  it("within_days=14 returns more creators than within_days=3", async () => {
    const res3 = await GET(makeGet({ within_days: "3" }));
    const res14 = await GET(makeGet({ within_days: "14" }));
    const { creators: c3 } = await res3.json();
    const { creators: c14 } = await res14.json();
    expect(c14.length).toBeGreaterThanOrEqual(c3.length);
  });

  it("within_days=1 may return an empty array when no creator qualifies", async () => {
    // Only StellarSam joined 1 day ago with 4 streams — she should appear
    const res = await GET(makeGet({ within_days: "1", min_streams: "100" }));
    const { creators } = await res.json();
    expect(creators).toHaveLength(0);
  });

  // varied min_streams

  it("min_streams=0 includes creators with zero streams", async () => {
    // LunarLens has 0 streams, joined 20 days ago
    const res = await GET(makeGet({ within_days: "30", min_streams: "0" }));
    const { creators } = await res.json();
    const zeroStreamCreator = creators.find(
      (c: NewCreator) => c.stream_count === 0
    );
    expect(zeroStreamCreator).toBeDefined();
  });

  it("min_streams=5 excludes creators with fewer streams", async () => {
    const res = await GET(makeGet({ within_days: "30", min_streams: "5" }));
    const { creators } = await res.json();
    for (const c of creators) {
      expect(c.stream_count).toBeGreaterThanOrEqual(5);
    }
  });

  it("very high min_streams returns an empty array", async () => {
    const res = await GET(makeGet({ within_days: "365", min_streams: "999" }));
    const { creators } = await res.json();
    expect(creators).toHaveLength(0);
  });

  // creator shape

  it("each creator has the expected fields", async () => {
    const res = await GET(makeGet({ within_days: "30", min_streams: "0" }));
    const { creators } = await res.json();
    expect(creators.length).toBeGreaterThan(0);
    const c = creators[0];
    expect(c).toHaveProperty("id");
    expect(c).toHaveProperty("name");
    expect(c).toHaveProperty("wallet_address");
    expect(c).toHaveProperty("avatar_url");
    expect(c).toHaveProperty("category");
    expect(c).toHaveProperty("joined_at");
    expect(c).toHaveProperty("stream_count");
    expect(c).toHaveProperty("followers");
    expect(typeof c.is_live).toBe("boolean");
  });

  // validation errors

  it("400 — within_days is negative", async () => {
    const res = await GET(makeGet({ within_days: "-1" }));
    expect(res.status).toBe(400);
  });

  it("400 — within_days is not a number", async () => {
    const res = await GET(makeGet({ within_days: "abc" }));
    expect(res.status).toBe(400);
  });

  it("400 — min_streams is negative", async () => {
    const res = await GET(makeGet({ min_streams: "-5" }));
    expect(res.status).toBe(400);
  });

  it("400 — within_days exceeds 365", async () => {
    const res = await GET(makeGet({ within_days: "500" }));
    expect(res.status).toBe(400);
  });
});

// Unit tests for helpers
describe("filterNewCreators", () => {
  it("respects a mocked now() for deterministic date math", () => {
    const fixedNow = new Date("2025-06-15T12:00:00Z");
    jest.spyOn(helpers, "now").mockReturnValue(fixedNow);

    const creators: NewCreator[] = [
      {
        id: "t-1",
        name: "Recent",
        wallet_address: "G...",
        avatar_url: "",
        category: "Test",
        joined_at: "2025-06-14T00:00:00Z", // 1 day ago
        stream_count: 2,
        followers: 5,
        is_live: false,
      },
      {
        id: "t-2",
        name: "Old",
        wallet_address: "G...",
        avatar_url: "",
        category: "Test",
        joined_at: "2025-05-01T00:00:00Z", // 45 days ago
        stream_count: 10,
        followers: 50,
        is_live: false,
      },
    ];

    const result = helpers.filterNewCreators(creators, 7, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t-1");

    jest.restoreAllMocks();
  });
});
