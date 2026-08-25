/**
 * POST /api/routes-f/channel-points-award-manual
 * Lets a moderator grant N channel points to a viewer with a reason string.
 */
import { NextRequest, NextResponse } from "next/server";
import type { AwardManualBody, AwardManualResponse } from "./types";
import { awardPoints } from "./store";

const MAX_AMOUNT = 1_000_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AwardManualBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { moderator_id, viewer_id, creator_id, amount, reason } = body;

  if (!moderator_id || typeof moderator_id !== "string") {
    return NextResponse.json({ error: "moderator_id is required" }, { status: 400 });
  }
  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }
  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive integer" },
      { status: 400 }
    );
  }
  if (amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `amount must not exceed ${MAX_AMOUNT}` },
      { status: 400 }
    );
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const { award, new_balance } = awardPoints(
    moderator_id,
    viewer_id,
    creator_id,
    amount,
    reason.trim()
  );

  return NextResponse.json(
    {
      award_id: award.award_id,
      viewer_id: award.viewer_id,
      creator_id: award.creator_id,
      amount: award.amount,
      reason: award.reason,
      new_balance,
      created_at: award.created_at,
    } as AwardManualResponse,
    { status: 201 }
  );
}
