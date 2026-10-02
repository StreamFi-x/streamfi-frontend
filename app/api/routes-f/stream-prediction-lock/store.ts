import type { Prediction } from "./types";
import { predictionStore, streamModerators } from "./seedData";

export class PredictionNotFoundError extends Error {}
export class PredictionNotOpenError extends Error {}
export class ModeratorNotAuthorizedError extends Error {}

/**
 * Locks an open prediction so it can no longer accept new entries.
 * Only a moderator assigned to the prediction's stream may lock it.
 */
export function lockPrediction(
  predictionId: string,
  moderatorId: string
): Prediction {
  const prediction = predictionStore.get(predictionId);
  if (!prediction) {
    throw new PredictionNotFoundError(
      `prediction '${predictionId}' not found`
    );
  }

  const mods = streamModerators.get(prediction.stream_id);
  if (!mods || !mods.has(moderatorId)) {
    throw new ModeratorNotAuthorizedError(
      `'${moderatorId}' is not a moderator for stream '${prediction.stream_id}'`
    );
  }

  if (prediction.status !== "open") {
    throw new PredictionNotOpenError(
      `prediction '${predictionId}' is already ${prediction.status}`
    );
  }

  const updated: Prediction = {
    ...prediction,
    status: "locked",
    locked_at: new Date().toISOString(),
    locked_by: moderatorId,
  };
  predictionStore.set(predictionId, updated);

  return updated;
}
