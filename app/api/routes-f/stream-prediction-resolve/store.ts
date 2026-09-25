import type { Payout, Prediction } from "./types";
import { predictionStore, predictionStakes, streamModerators } from "./seedData";
import { balanceStorage } from "../channel-points/_lib/mock-storage";

export class PredictionNotFoundError extends Error {}
export class PredictionNotResolvableError extends Error {}
export class ModeratorNotAuthorizedError extends Error {}
export class InvalidWinningOutcomeError extends Error {}

/**
 * Resolves a locked prediction by declaring a winning outcome and paying
 * out the full channel-points pot to viewers who staked on that outcome,
 * proportional to their share of the winning side's total stake.
 *
 * Payout formula per winning stake:
 *   payout = stake + stake * (losingPot / winningPot)
 * i.e. each winner gets their own stake back, plus a slice of the losing
 * pot proportional to how much of the winning pot they contributed. The
 * sum of all payouts equals the full pot (winningPot + losingPot), so no
 * points are created or destroyed — they're only redistributed from
 * losers to winners.
 *
 * If nobody staked on the winning outcome, the pot is not distributed
 * (there's nobody to receive it) — the prediction still resolves, but
 * payouts is empty. Only a "locked" prediction may be resolved: "open"
 * predictions are still accepting entries, and "resolved"/"cancelled"
 * predictions have already reached a terminal state.
 */
export function resolvePrediction(
  predictionId: string,
  moderatorId: string,
  winningOutcome: string
): { prediction: Prediction; payouts: Payout[] } {
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

  if (prediction.status !== "locked") {
    throw new PredictionNotResolvableError(
      `prediction '${predictionId}' must be locked to resolve (current status: '${prediction.status}')`
    );
  }

  const outcomeExists = prediction.outcomes.some((o) => o.label === winningOutcome);
  if (!outcomeExists) {
    throw new InvalidWinningOutcomeError(
      `winningOutcome '${winningOutcome}' is not one of this prediction's outcomes`
    );
  }

  const stakes = predictionStakes.get(predictionId) ?? [];
  const winningStakes = stakes.filter((s) => s.outcome_label === winningOutcome);
  const losingStakes = stakes.filter((s) => s.outcome_label !== winningOutcome);

  const winningPot = winningStakes.reduce((sum, s) => sum + s.points, 0);
  const losingPot = losingStakes.reduce((sum, s) => sum + s.points, 0);

  const payouts: Payout[] = [];

  if (winningPot > 0) {
    for (const stake of winningStakes) {
      const share = stake.points / winningPot;
      const payout = Math.floor(stake.points + share * losingPot);
      if (payout > 0) {
        balanceStorage.grant(stake.viewer_id, stake.creator_id, payout);
      }
      payouts.push({
        viewer_id: stake.viewer_id,
        points_staked: stake.points,
        points_paid: payout,
      });
    }
  }
  // If winningPot is 0 (nobody backed the winning outcome), the losing
  // pot has no eligible recipient and is not distributed.

  const updated: Prediction = {
    ...prediction,
    status: "resolved",
    resolved_at: new Date().toISOString(),
    winning_outcome: winningOutcome,
  };
  predictionStore.set(predictionId, updated);

  // Clear stakes so a resolve can't be triggered twice against the same
  // stake list (defensive — the status check above already blocks re-entry).
  predictionStakes.set(predictionId, []);

  return { prediction: updated, payouts };
}
