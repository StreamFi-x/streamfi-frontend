import { type NextRequest, NextResponse } from "next/server";
import { buildSitemap } from "./_lib/helpers";
import type { SitemapResponse } from "./_lib/types";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const sitemap = buildSitemap(body);
    return NextResponse.json({ sitemap } satisfies SitemapResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate sitemap.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
