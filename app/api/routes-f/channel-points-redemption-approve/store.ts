import type { Redemption } from "./types";
import { redemptionStore } from "./seedData";

export class RedemptionNotFoundError extends Error {}
export class RedemptionNotPendingError extends Error {}

export function approveRedemption(
  redemptionId: string,
  moderatorId: string
): { redemption: Redemption } {
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
    status: "approved",
    resolved_at: new Date().toISOString(),
    resolved_by: moderatorId,
  };
  redemptionStore.set(redemptionId, updated);

  return { redemption: updated };
}
