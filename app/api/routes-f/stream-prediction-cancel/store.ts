import type { Prediction, RefundedStake } from "./types";
import { predictionStore, predictionStakes, streamModerators } from "./seedData";
import { balanceStorage } from "../channel-points/_lib/mock-storage";

export class PredictionNotFoundError extends Error {}
export class PredictionAlreadyResolvedError extends Error {}
export class PredictionAlreadyCancelledError extends Error {}
export class ModeratorNotAuthorizedError extends Error {}

/**
 * Cancels a prediction and refunds every viewer's staked channel points in
 * full. Can cancel an "open" or "locked" prediction — cancellation is not
 * possible once a prediction has already resolved (payouts have happened)
 * or was already cancelled. Only a moderator assigned to the prediction's
 * stream may cancel it.
 */
export function cancelPrediction(
  predictionId: string,
  moderatorId: string
): { prediction: Prediction; refunds: RefundedStake[] } {
  const prediction = predictionStore.get(predictionId);
  if (!prediction) {
    throw new PredictionNotFoundError(`prediction '${predictionId}' not found`);
  }

  const mods = streamModerators.get(prediction.stream_id);
  if (!mods || !mods.has(moderatorId)) {
    throw new ModeratorNotAuthorizedError(
      `'${moderatorId}' is not a moderator for stream '${prediction.stream_id}'`
    );
  }

  if (prediction.status === "resolved") {
    throw new PredictionAlreadyResolvedError(
      `prediction '${predictionId}' has already resolved and cannot be cancelled`
    );
  }
  if (prediction.status === "cancelled") {
    throw new PredictionAlreadyCancelledError(
      `prediction '${predictionId}' is already cancelled`
    );
  }

  const stakes = predictionStakes.get(predictionId) ?? [];
  const refunds: RefundedStake[] = stakes
    .filter((stake) => stake.points > 0)
    .map((stake) => {
      balanceStorage.grant(stake.viewer_id, stake.creator_id, stake.points);
      return { viewer_id: stake.viewer_id, points_refunded: stake.points };
    });

  // All stakes have been refunded — clear them so a second cancel attempt
  // (blocked by the status check above, but defensive) can't double-refund.
  predictionStakes.set(predictionId, []);

  const updated: Prediction = {
    ...prediction,
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
  };
  predictionStore.set(predictionId, updated);

  return { prediction: updated, refunds };
}
