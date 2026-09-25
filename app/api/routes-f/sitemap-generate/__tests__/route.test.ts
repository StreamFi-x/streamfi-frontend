/**
 * @jest-environment node
 */

describe("GET /api/routes-f/sitemap-generate", () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns 200 with an XML sitemap", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
    const xml = await res.text();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
  });

  it("sets a 6-hour Cache-Control header", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("max-age=21600");
    expect(cacheControl).toContain("public");
  });

  it("includes only live channels, not offline ones", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain("nova_streams");
    expect(xml).toContain("pixel_forge");
    expect(xml).not.toContain("quiet_offline_channel");
  });

  it("includes recent VODs but excludes VODs older than the recency window", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain("vod_1001");
    expect(xml).toContain("vod_1002");
    expect(xml).not.toContain("vod_old_1");
  });

  it("serves the same sitemap content from cache on a second request", async () => {
    const { GET } = await import("../route");

    const first = await GET();
    const firstXml = await first.text();
    // give the fire-and-forget setCachedJson a tick to resolve
    await new Promise((r) => setTimeout(r, 10));
    const second = await GET();
    const secondXml = await second.text();

    expect(second.status).toBe(200);
    expect(secondXml).toBe(firstXml);
  });

  it("returns 500 if sitemap generation throws", async () => {
    jest.doMock("../_lib/build-sitemap", () => ({
      buildSitemapXml: () => {
        throw new Error("boom");
      },
    }));
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
    jest.dontMock("../_lib/build-sitemap");
  });
});

describe("isRecentVod", () => {
  it("treats a VOD published exactly at the window boundary as recent", async () => {
    const { isRecentVod } = await import("../_lib/build-sitemap");
    const now = Date.parse("2026-08-28T00:00:00.000Z");
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      isRecentVod({ id: "v", username: "u", published_at: thirtyDaysAgo }, now)
    ).toBe(true);
  });

  it("excludes a VOD published just past the window boundary", async () => {
    const { isRecentVod } = await import("../_lib/build-sitemap");
    const now = Date.parse("2026-08-28T00:00:00.000Z");
    const tooOld = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecentVod({ id: "v", username: "u", published_at: tooOld }, now)).toBe(
      false
    );
  });

  it("excludes a VOD with an invalid published_at", async () => {
    const { isRecentVod } = await import("../_lib/build-sitemap");
    expect(
      isRecentVod({ id: "v", username: "u", published_at: "not-a-date" })
    ).toBe(false);
  });

  it("excludes a VOD published in the future", async () => {
    const { isRecentVod } = await import("../_lib/build-sitemap");
    const now = Date.parse("2026-08-28T00:00:00.000Z");
    const future = new Date(now + 60 * 60 * 1000).toISOString();
    expect(isRecentVod({ id: "v", username: "u", published_at: future }, now)).toBe(
      false
    );
  });
});
