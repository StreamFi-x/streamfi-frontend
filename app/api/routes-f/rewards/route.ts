import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import {
  ensureRewardsSchema,
  getRewardBalance,
  syncRewardEventsForUser,
} from "./_lib/db";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureRewardsSchema();
    await syncRewardEventsForUser(session.userId, session.wallet);

    const balance = await getRewardBalance(session.userId);

    return NextResponse.json({
      points_balance: balance.pointsBalance,
      lifetime_points: balance.lifetimePoints,
      tier: balance.tier,
    });
  } catch (error) {
    console.error("[routes-f/rewards] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
