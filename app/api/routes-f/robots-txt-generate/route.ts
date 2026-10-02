import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/robots-txt-generate (#1548)
 *
 * Returns a dynamic robots.txt reflecting the current environment's
 * allow-list, so preview/staging deployments are disallowed from
 * indexing entirely while production reflects the real crawl rules.
 *
 * Distinct from POST /api/routes-f/robots-txt, which builds robots.txt
 * content from an arbitrary caller-supplied rule set — this route is
 * env-driven and requires no request body.
 */

const PRODUCTION_DISALLOW_PATHS = ["/api/", "/admin/", "/dashboard/settings"];

function isProductionEnvironment(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

function buildRobotsTxt(): string {
  if (!isProductionEnvironment()) {
    // Preview/staging/dev deployments should never be indexed.
    return "User-agent: *\nDisallow: /\n";
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const lines = ["User-agent: *"];

  for (const path of PRODUCTION_DISALLOW_PATHS) {
    lines.push(`Disallow: ${path}`);
  }
  lines.push("Allow: /");

  if (siteUrl) {
    lines.push("", `Sitemap: ${siteUrl.replace(/\/$/, "")}/sitemap.xml`);
  }

  return lines.join("\n") + "\n";
}

export async function GET(): Promise<NextResponse> {
  const body = buildRobotsTxt();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
