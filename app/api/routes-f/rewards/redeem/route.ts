import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import {
  ensureRewardBalanceRow,
  ensureRewardsSchema,
  getRewardBalance,
  getRewardDefinition,
  syncRewardEventsForUser,
  withRewardsTransaction,
} from "../_lib/db";

const redeemBodySchema = z.object({
  reward_id: z.string().min(1, "reward_id is required"),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, redeemBodySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { reward_id, quantity } = bodyResult.data;
  const reward = getRewardDefinition(reward_id);
  if (!reward) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  }

  const totalCost = reward.cost * quantity;

  try {
    await ensureRewardsSchema();

    const redemption = await withRewardsTransaction(async client => {
      await ensureRewardBalanceRow(session.userId, client);

      await client.sql`
        SELECT user_id
        FROM viewer_reward_balances
        WHERE user_id = ${session.userId}
        FOR UPDATE
      `;

      await syncRewardEventsForUser(session.userId, session.wallet, client);

      const balance = await getRewardBalance(session.userId, client);
      if (balance.pointsBalance < totalCost) {
        return {
          ok: false as const,
          balance,
        };
      }

      await client.sql`
        UPDATE viewer_reward_balances
        SET
          points_balance = points_balance - ${totalCost},
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${session.userId}
      `;

      await client.sql`
        INSERT INTO viewer_reward_events (
          user_id,
          source_key,
          event_type,
          points,
          metadata
        )
        VALUES (
          ${session.userId},
          ${`redeem:${crypto.randomUUID()}`},
          'redeem',
          ${-totalCost},
          ${JSON.stringify({
            reward_id: reward.id,
            reward_name: reward.name,
            quantity,
            unit_cost: reward.cost,
            total_cost: totalCost,
          })}::jsonb
        )
      `;

      const updatedBalance = await getRewardBalance(session.userId, client);

      return {
        ok: true as const,
        balance: updatedBalance,
      };
    });

    if (!redemption.ok) {
      return NextResponse.json(
        {
          error: "Insufficient points",
          points_balance: redemption.balance.pointsBalance,
          tier: redemption.balance.tier,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      reward_id: reward.id,
      reward_name: reward.name,
      quantity,
      points_spent: totalCost,
      points_balance: redemption.balance.pointsBalance,
      tier: redemption.balance.tier,
    });
  } catch (error) {
    console.error("[routes-f/rewards/redeem] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
