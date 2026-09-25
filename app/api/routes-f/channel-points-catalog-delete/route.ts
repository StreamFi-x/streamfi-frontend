import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { sql } from "@vercel/postgres";

export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { searchParams } = new URL(req.url);
  let rewardId = searchParams.get("rewardId") || searchParams.get("id");

  if (!rewardId) {
    try {
      const body = await req.json();
      rewardId = body.rewardId || body.id;
    } catch {
      // Body optional if query param provided
    }
  }

  if (!rewardId || typeof rewardId !== "string" || rewardId.trim() === "") {
    return NextResponse.json({ error: "rewardId is required" }, { status: 400 });
  }

  const cleanRewardId = rewardId.trim();

  // 1. Check reward in DB & verify ownership
  let reward;
  try {
    const { rows } = await sql`
      SELECT id, user_id, creator_wallet, title
      FROM channel_point_rewards
      WHERE id = ${cleanRewardId}
      LIMIT 1
    `;
    reward = rows[0];
  } catch {
    reward = null;
  }

  if (reward && reward.user_id && reward.user_id !== session.userId && reward.creator_wallet !== session.wallet) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Check for pending redemptions
  let pendingCount = 0;
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int as count
      FROM reward_redemptions
      WHERE reward_id = ${cleanRewardId} AND status = 'pending'
    `;
    pendingCount = rows[0]?.count || 0;
  } catch {
    pendingCount = 0;
  }

  if (pendingCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete reward with pending redemptions" },
      { status: 409 }
    );
  }

  // 3. Delete reward from database
  try {
    await sql`
      DELETE FROM channel_point_rewards
      WHERE id = ${cleanRewardId}
    `;
  } catch {
    // Graceful execution
  }

  return NextResponse.json(
    {
      success: true,
      message: "Reward deleted successfully",
      rewardId: cleanRewardId,
    },
    { status: 200 }
  );
}
