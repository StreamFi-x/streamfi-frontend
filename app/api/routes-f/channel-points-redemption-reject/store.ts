import type { Redemption } from "./types";
import { balances, balanceKey, redemptionStore } from "./seedData";

export class RedemptionNotFoundError extends Error {}
export class RedemptionNotPendingError extends Error {}

export function rejectRedemption(
  redemptionId: string,
  moderatorId: string
): { redemption: Redemption; refunded_amount: number; new_balance: number } {
  const redemption = redemptionStore.get(redemptionId);
  if (!redemption) {
    throw new RedemptionNotFoundError(`redemption '${redemptionId}' not found`);
  }
  if (redemption.status !== "pending") {
    throw new RedemptionNotPendingError(
      `redemption '${redemptionId}' is already ${redemption.status}`
    );
  }

  const updated: Redemption = {
    ...redemption,
    status: "rejected",
    resolved_at: new Date().toISOString(),
    resolved_by: moderatorId,
  };
  redemptionStore.set(redemptionId, updated);

  const key = balanceKey(redemption.viewer_id, redemption.creator_id);
  const newBalance = (balances.get(key) ?? 0) + redemption.cost;
  balances.set(key, newBalance);

  return { redemption: updated, refunded_amount: redemption.cost, new_balance: newBalance };
}
