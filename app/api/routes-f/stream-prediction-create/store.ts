import type { Prediction, PredictionOutcome } from "./types";

export const predictionStore = new Map<string, Prediction>();

let counter = 0;

function generateId(): string {
  return `prediction_${++counter}`;
}

export function createPrediction(
  streamId: string,
  question: string,
  outcomeLabels: string[],
  lockAfterSec: number,
  now: number = Date.now()
): Prediction {
  const outcomes: PredictionOutcome[] = outcomeLabels.map((label) => ({
    label,
    points: 0,
  }));

  const prediction: Prediction = {
    prediction_id: generateId(),
    stream_id: streamId,
    question,
    outcomes,
    lock_after_sec: lockAfterSec,
    status: "open",
    created_at: new Date(now).toISOString(),
    locks_at: new Date(now + lockAfterSec * 1000).toISOString(),
  };

  predictionStore.set(prediction.prediction_id, prediction);
  return prediction;
}

export function resetStore(): void {
  predictionStore.clear();
  counter = 0;
}
