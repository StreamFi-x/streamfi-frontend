import type { Prediction, PredictionStake } from "./types";

// Moderators authorized to resolve a prediction, keyed by stream_id.
export const streamModerators = new Map<string, Set<string>>([
  ["stream_a", new Set(["mod_1", "mod_2"])],
  ["stream_b", new Set(["mod_3"])],
]);

function initialPredictions(): Array<[string, Prediction]> {
  return [
    [
      "prediction_locked_1",
      {
        prediction_id: "prediction_locked_1",
        stream_id: "stream_a",
        question: "Will the boss fight be won on the first try?",
        outcomes: [
          { label: "Yes", points: 300 },
          { label: "No", points: 150 },
        ],
        status: "locked",
        created_at: "2026-01-01T00:00:00.000Z",
        locked_at: "2026-01-01T00:10:00.000Z",
        locked_by: "mod_1",
        resolved_at: null,
        winning_outcome: null,
      },
    ],
    [
      "prediction_open_1",
      {
        prediction_id: "prediction_open_1",
        stream_id: "stream_a",
        question: "Will the raid clear before midnight?",
        outcomes: [
          { label: "Yes", points: 100 },
          { label: "No", points: 50 },
        ],
        status: "open",
        created_at: "2025-12-01T00:00:00.000Z",
        locked_at: null,
        locked_by: null,
        resolved_at: null,
        winning_outcome: null,
      },
    ],
    [
      "prediction_already_resolved",
      {
        prediction_id: "prediction_already_resolved",
        stream_id: "stream_a",
        question: "Will the guest win the tournament?",
        outcomes: [
          { label: "Yes", points: 0 },
          { label: "No", points: 0 },
        ],
        status: "resolved",
        created_at: "2025-11-01T00:00:00.000Z",
        locked_at: "2025-11-01T01:00:00.000Z",
        locked_by: "mod_2",
        resolved_at: "2025-11-01T02:00:00.000Z",
        winning_outcome: "Yes",
      },
    ],
    [
      "prediction_no_stakes",
      {
        prediction_id: "prediction_no_stakes",
        stream_id: "stream_a",
        question: "Will anyone actually bet on this?",
        outcomes: [
          { label: "Yes", points: 0 },
          { label: "No", points: 0 },
        ],
        status: "locked",
        created_at: "2026-01-05T00:00:00.000Z",
        locked_at: "2026-01-05T00:10:00.000Z",
        locked_by: "mod_1",
        resolved_at: null,
        winning_outcome: null,
      },
    ],
    [
      "prediction_no_winners",
      {
        prediction_id: "prediction_no_winners",
        stream_id: "stream_a",
        question: "Will the challenge be attempted at all?",
        outcomes: [
          { label: "Yes", points: 0 },
          { label: "No", points: 80 },
        ],
        status: "locked",
        created_at: "2026-01-06T00:00:00.000Z",
        locked_at: "2026-01-06T00:10:00.000Z",
        locked_by: "mod_1",
        resolved_at: null,
        winning_outcome: null,
      },
    ],
  ];
}

function initialStakes(): Array<[string, PredictionStake[]]> {
  return [
    [
      "prediction_locked_1",
      [
        { viewer_id: "viewer_1", creator_id: "creator_a", outcome_label: "Yes", points: 200 },
        { viewer_id: "viewer_2", creator_id: "creator_a", outcome_label: "Yes", points: 100 },
        { viewer_id: "viewer_3", creator_id: "creator_a", outcome_label: "No", points: 150 },
      ],
    ],
    [
      "prediction_no_winners",
      [{ viewer_id: "viewer_4", creator_id: "creator_a", outcome_label: "No", points: 80 }],
    ],
  ];
}

// Predictions keyed by prediction_id.
export const predictionStore = new Map<string, Prediction>(initialPredictions());

// Stakes keyed by prediction_id — every viewer's channel-points bet on that
// prediction, used to compute proportional payouts on resolution.
export const predictionStakes = new Map<string, PredictionStake[]>(initialStakes());

/**
 * Restores predictionStore and predictionStakes to their initial seed
 * state. Used between tests so resolving a prediction in one test doesn't
 * leak into the next (each test file shares one module registry).
 */
export function resetSeedData(): void {
  predictionStore.clear();
  for (const [id, prediction] of initialPredictions()) {
    predictionStore.set(id, prediction);
  }

  predictionStakes.clear();
  for (const [id, stakes] of initialStakes()) {
    predictionStakes.set(id, stakes);
  }
}
