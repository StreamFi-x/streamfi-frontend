/**
 * GET /api/routes-f/badge-catalog?creator_id=<id>
 * Returns all badges defined for a channel, including image URL and the
 * rule that unlocks each one.
 */
import { NextRequest, NextResponse } from "next/server";
import type { BadgeCatalogResponse } from "./types";
import { getBadgeCatalog } from "./seedData";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId || !creatorId.trim()) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const badges = getBadgeCatalog(creatorId.trim());

  return NextResponse.json({
    creator_id: creatorId.trim(),
    badges,
  } as BadgeCatalogResponse);
}
