/**
 * GET  /api/routes-f/channel-content-rating?creator_id=<id>
 *   Returns { rating: "family" | "teen" | "mature" }
 *
 * PUT  /api/routes-f/channel-content-rating
 *   Body: { creator_id, rating: "family" | "teen" | "mature" }
 *   Sets the creator's channel rating.
 */
import { NextRequest, NextResponse } from "next/server";
import { ratings, VALID_RATINGS, getRating } from "./store";
import type { Rating } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const creator_id = req.nextUrl.searchParams.get("creator_id");
  if (!creator_id) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  return NextResponse.json({ rating: getRating(creator_id) });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, rating } = (body ?? {}) as Record<string, unknown>;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  if (!rating || !VALID_RATINGS.includes(rating as Rating)) {
    return NextResponse.json(
      { error: `rating must be one of: ${VALID_RATINGS.join(", ")}` },
      { status: 400 }
    );
  }

  ratings.set(creator_id, rating as Rating);
  return NextResponse.json({ creator_id, rating });
}
