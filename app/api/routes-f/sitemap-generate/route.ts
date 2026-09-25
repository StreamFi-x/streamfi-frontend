/**
 * GET /api/routes-f/sitemap-generate
 *
 * Returns an XML sitemap covering currently-live channels and VODs
 * published within the last 30 days. The response is cached for 6 hours
 * both via the `Cache-Control` header (CDN/browser) and via the shared
 * routes-f cache helper (`lib/routes-f/cache.ts`, Redis-backed with an
 * in-memory fallback) so repeated requests within the window skip
 * rebuilding the XML.
 */
import { NextResponse } from "next/server";
import { getCachedJson, setCachedJson } from "@/lib/routes-f/cache";
import { buildSitemapXml } from "./_lib/build-sitemap";

const CACHE_KEY = "routes-f:sitemap-generate:xml";
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

export async function GET(): Promise<NextResponse> {
  try {
    const cached = await getCachedJson<string>(CACHE_KEY);
    const xml = cached ?? buildSitemapXml();

    if (!cached) {
      // Best-effort — a cache write failure shouldn't fail the request.
      setCachedJson(CACHE_KEY, xml, CACHE_TTL_SECONDS).catch((error) => {
        console.warn("[sitemap-generate] failed to populate cache:", error);
      });
    }

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
      },
    });
  } catch (error) {
    console.error("[sitemap-generate] failed to build sitemap:", error);
    return NextResponse.json(
      { error: "Failed to generate sitemap" },
      { status: 500 }
    );
  }
}
