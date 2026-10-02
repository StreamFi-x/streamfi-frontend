/**
 * POST /api/routes-f/channel-points-redemption-approve
 * A moderator marks a pending channel-points redemption as approved,
 * signalling that the reward has been fulfilled for the viewer.
 */
import { NextRequest, NextResponse } from "next/server";
import type { RedemptionApproveBody, RedemptionApproveResponse } from "./types";
import { approveRedemption, RedemptionNotFoundError, RedemptionNotPendingError } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RedemptionApproveBody;
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
    const { redemption } = approveRedemption(redemption_id, moderator_id);

    return NextResponse.json({ redemption } as RedemptionApproveResponse);
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
