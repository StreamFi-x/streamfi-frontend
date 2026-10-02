import type { Redemption } from "./types";
import { balances, balanceKey, rewardCatalog, redemptionStore } from "./seedData";

export class RewardNotFoundError extends Error {}
export class InsufficientBalanceError extends Error {}

let redemptionCounter = 1;

export function getBalance(viewerId: string, creatorId: string): number {
  return balances.get(balanceKey(viewerId, creatorId)) ?? 0;
}

export function redeemReward(
  viewerId: string,
  creatorId: string,
  rewardId: string
): { redemption: Redemption; new_balance: number } {
  const reward = rewardCatalog.get(rewardId);
  if (!reward || reward.creator_id !== creatorId) {
    throw new RewardNotFoundError(
      `reward '${rewardId}' not found for creator '${creatorId}'`
    );
  }

  const key = balanceKey(viewerId, creatorId);
  const currentBalance = getBalance(viewerId, creatorId);
  if (currentBalance < reward.cost) {
    throw new InsufficientBalanceError(
      `viewer '${viewerId}' has ${currentBalance} points, but '${reward.name}' costs ${reward.cost}`
    );
  }

  const newBalance = currentBalance - reward.cost;
  balances.set(key, newBalance);

  const redemption: Redemption = {
    redemption_id: `redemption_${String(redemptionCounter++).padStart(4, "0")}`,
    viewer_id: viewerId,
    creator_id: creatorId,
    reward_id: reward.reward_id,
    reward_name: reward.name,
    cost: reward.cost,
    status: "pending",
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
  };
  redemptionStore.set(redemption.redemption_id, redemption);

  return { redemption, new_balance: newBalance };
}
