import { NextRequest, NextResponse } from "next/server";
import type { SimilarCreatorsResponse } from "./types";
import { creatorGraph, getCreator } from "./seed";
import { rankSimilarCreators } from "./similarity";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * GET /api/routes-f/similar-creators?creator_id=creator_a&limit=10
 *
 * Returns creators similar to the given creator, scored by the sum of the
 * Jaccard index over their categories and over their follower sets.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;

  const creatorId = params.get("creator_id");
  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  let limit = DEFAULT_LIMIT;
  const limitRaw = params.get("limit");
  if (limitRaw !== null) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed)) {
      return NextResponse.json(
        { error: "limit must be an integer" },
        { status: 400 }
      );
    }
    if (parsed < 1) {
      return NextResponse.json(
        { error: "limit must be at least 1" },
        { status: 400 }
      );
    }
    if (parsed > MAX_LIMIT) {
      return NextResponse.json(
        { error: `limit must be at most ${MAX_LIMIT}` },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  const target = getCreator(creatorId);
  if (!target) {
    return NextResponse.json(
      { error: `unknown creator_id: ${creatorId}` },
      { status: 404 }
    );
  }

  const creators = rankSimilarCreators(target, creatorGraph, limit);
  return NextResponse.json({ creators } as SimilarCreatorsResponse);
}
