/**
 * GET /api/routes-f/subscription-tier-list?creator_id=<id>
 * Returns active subscription tiers for a channel, including price,
 * benefits, and badge.
 */
import { NextRequest, NextResponse } from "next/server";
import { getActiveTiersForCreator } from "./seedData";
import { toListEntry } from "./utils";
import type { SubscriptionTierListResponse } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const tiers = getActiveTiersForCreator(creatorId).map(toListEntry);

  return NextResponse.json({ tiers } as SubscriptionTierListResponse);
}
