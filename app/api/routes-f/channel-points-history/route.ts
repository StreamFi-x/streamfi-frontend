/**
 * GET /api/routes-f/channel-points-history?viewer_id=<id>&creator_id=<id>&limit=<n>
 * Returns a viewer's earn and redemption ledger for one channel, most
 * recent entry first.
 */
import { NextRequest, NextResponse } from "next/server";
import type { ChannelPointsHistoryResponse } from "./types";
import { generateLedger } from "./seedData";
import { sortByCreatedAtDesc } from "./utils";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewer_id");
  const creatorId = searchParams.get("creator_id");

  if (!viewerId || !viewerId.trim()) {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }
  if (!creatorId || !creatorId.trim()) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const rawLimit = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = parseInt(rawLimit, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return NextResponse.json(
        { error: `limit must be an integer between 1 and ${MAX_LIMIT}` },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  const ledger = sortByCreatedAtDesc(
    generateLedger(viewerId.trim(), creatorId.trim())
  ).slice(0, limit);

  return NextResponse.json({
    viewer_id: viewerId.trim(),
    creator_id: creatorId.trim(),
    ledger,
  } as ChannelPointsHistoryResponse);
}
