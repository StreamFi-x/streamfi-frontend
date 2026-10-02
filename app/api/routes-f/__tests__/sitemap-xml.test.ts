/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../sitemap-xml/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/sitemap-xml", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/sitemap-xml", () => {
  it("generates a valid sitemap with a single required loc", async () => {
    const res = await POST(makeReq({ urls: [{ loc: "https://example.com/" }] }));
    expect(res.status).toBe(200);
    const { sitemap } = await res.json();
    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("<loc>https://example.com/</loc>");
    expect(sitemap).toContain("</urlset>");
  });

  it("includes optional fields when provided", async () => {
    const res = await POST(
      makeReq({
        urls: [
          {
            loc: "https://example.com/page",
            lastmod: "2024-01-15",
            changefreq: "weekly",
            priority: 0.8,
          },
        ],
      })
    );
    expect(res.status).toBe(200);
    const { sitemap } = await res.json();
    expect(sitemap).toContain("<lastmod>2024-01-15</lastmod>");
    expect(sitemap).toContain("<changefreq>weekly</changefreq>");
    expect(sitemap).toContain("<priority>0.8</priority>");
  });

  it("omits optional fields when not provided", async () => {
    const res = await POST(makeReq({ urls: [{ loc: "https://example.com/" }] }));
    expect(res.status).toBe(200);
    const { sitemap } = await res.json();
    expect(sitemap).not.toContain("<lastmod>");
    expect(sitemap).not.toContain("<changefreq>");
    expect(sitemap).not.toContain("<priority>");
  });

  it("handles multiple URL entries", async () => {
    const res = await POST(
      makeReq({
        urls: [
          { loc: "https://example.com/" },
          { loc: "https://example.com/about", priority: 0.5 },
          { loc: "https://example.com/blog", changefreq: "daily" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const { sitemap } = await res.json();
    expect((sitemap.match(/<url>/g) ?? []).length).toBe(3);
  });

  it("escapes XML special characters in loc", async () => {
    const res = await POST(
      makeReq({ urls: [{ loc: "https://example.com/path?a=1&b=2" }] })
    );
    expect(res.status).toBe(200);
    const { sitemap } = await res.json();
    expect(sitemap).toContain("&amp;");
    expect(sitemap).not.toContain("&b=");
  });

  it("rejects invalid loc (not a URL)", async () => {
    const res = await POST(makeReq({ urls: [{ loc: "not-a-url" }] }));
    expect(res.status).toBe(400);
  });

  it("rejects priority outside [0, 1]", async () => {
    const res = await POST(
      makeReq({ urls: [{ loc: "https://example.com/", priority: 1.5 }] })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid changefreq", async () => {
    const res = await POST(
      makeReq({ urls: [{ loc: "https://example.com/", changefreq: "sometimes" }] })
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty urls array", async () => {
    const res = await POST(makeReq({ urls: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects missing urls field", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/sitemap-xml", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("accepts priority of exactly 0 and 1", async () => {
    const res = await POST(
      makeReq({
        urls: [
          { loc: "https://example.com/low", priority: 0 },
          { loc: "https://example.com/high", priority: 1 },
        ],
      })
    );
    expect(res.status).toBe(200);
  });
});
