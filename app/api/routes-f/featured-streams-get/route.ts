/**
 * GET /api/routes-f/featured-streams-get
 *
 * Returns the current ordered array of featured streams (the homepage
 * carousel), ordered by editorial position ascending.
 */
import { NextResponse } from "next/server";
import { FEATURED_STREAMS } from "./seed";
import type { FeaturedStreamsResponse } from "./types";

export async function GET(): Promise<NextResponse<FeaturedStreamsResponse>> {
  const featured = [...FEATURED_STREAMS].sort((a, b) => a.position - b.position);
  return NextResponse.json({ featured });
}
