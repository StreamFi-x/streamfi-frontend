/**
 * POST /api/routes-f/channel-points-redemption-reject
 * A moderator marks a pending channel-points redemption as rejected and
 * refunds the spent points back to the viewer's balance.
 */
import { NextRequest, NextResponse } from "next/server";
import type { RedemptionRejectBody, RedemptionRejectResponse } from "./types";
import { rejectRedemption, RedemptionNotFoundError, RedemptionNotPendingError } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RedemptionRejectBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { redemption_id, moderator_id } = body;

  if (!redemption_id || typeof redemption_id !== "string") {
    return NextResponse.json({ error: "redemption_id is required" }, { status: 400 });
  }
  if (!moderator_id || typeof moderator_id !== "string") {
    return NextResponse.json({ error: "moderator_id is required" }, { status: 400 });
  }

  try {
    const { redemption, refunded_amount, new_balance } = rejectRedemption(
      redemption_id,
      moderator_id
    );

    return NextResponse.json({
      redemption,
      refunded_amount,
      new_balance,
    } as RedemptionRejectResponse);
  } catch (error) {
    if (error instanceof RedemptionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof RedemptionNotPendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
