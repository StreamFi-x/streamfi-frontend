/**
 * @jest-environment node
 */
import { GET } from "../route";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("GET /api/routes-f/robots-txt-generate", () => {
  it("disallows everything on a non-production environment", async () => {
    process.env.VERCEL_ENV = "preview";

    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(body).toBe("User-agent: *\nDisallow: /\n");
  });

  it("reflects the production allow-list when VERCEL_ENV is production", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const res = await GET();
    const body = await res.text();

    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /admin/");
    expect(body).toContain("Allow: /");
    expect(body).not.toContain("Sitemap:");
  });

  it("includes a sitemap line when NEXT_PUBLIC_SITE_URL is configured in production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://streamfi.example/";

    const res = await GET();
    const body = await res.text();

    expect(body).toContain("Sitemap: https://streamfi.example/sitemap.xml");
  });

  it("sets a 1-hour cache control header", async () => {
    process.env.VERCEL_ENV = "production";

    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });
});
