/**
 * POST /api/routes-f/channel-points-redeem
 * Accepts a reward_id, deducts its cost from the viewer's channel-points
 * balance, and creates a redemption row in status "pending" for a moderator
 * to later approve or reject.
 */
import { NextRequest, NextResponse } from "next/server";
import type { RedeemBody, RedeemResponse } from "./types";
import { redeemReward, RewardNotFoundError, InsufficientBalanceError } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RedeemBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { viewer_id, creator_id, reward_id } = body;

  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }
  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  if (!reward_id || typeof reward_id !== "string") {
    return NextResponse.json({ error: "reward_id is required" }, { status: 400 });
  }

  try {
    const { redemption, new_balance } = redeemReward(viewer_id, creator_id, reward_id);

    return NextResponse.json(
      { redemption, new_balance } as RedeemResponse,
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RewardNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
