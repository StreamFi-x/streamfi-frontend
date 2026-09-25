import type { Prediction, PredictionStake } from "./types";

// Moderators authorized to cancel a prediction, keyed by stream_id.
export const streamModerators = new Map<string, Set<string>>([
  ["stream_a", new Set(["mod_1", "mod_2"])],
  ["stream_b", new Set(["mod_3"])],
]);

export const predictionStore = new Map<string, Prediction>([
  [
    "prediction_open_1",
    {
      prediction_id: "prediction_open_1",
      stream_id: "stream_a",
      question: "Will the boss fight be won on the first try?",
      outcomes: [
        { label: "Yes", points: 300 },
        { label: "No", points: 150 },
      ],
      status: "open",
      created_at: "2026-01-01T00:00:00.000Z",
      locked_at: null,
      locked_by: null,
      cancelled_at: null,
    },
  ],
  [
    "prediction_locked_1",
    {
      prediction_id: "prediction_locked_1",
      stream_id: "stream_a",
      question: "Will the raid clear before midnight?",
      outcomes: [
        { label: "Yes", points: 100 },
        { label: "No", points: 50 },
      ],
      status: "locked",
      created_at: "2025-12-01T00:00:00.000Z",
      locked_at: "2025-12-01T01:00:00.000Z",
      locked_by: "mod_1",
      cancelled_at: null,
    },
  ],
  [
    "prediction_resolved_1",
    {
      prediction_id: "prediction_resolved_1",
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
      cancelled_at: null,
    },
  ],
]);

// Stakes keyed by prediction_id — every viewer's channel-points bet on that
// prediction, to be refunded in full if the prediction is cancelled.
export const predictionStakes = new Map<string, PredictionStake[]>([
  [
    "prediction_open_1",
    [
      { viewer_id: "viewer_1", creator_id: "creator_a", outcome_label: "Yes", points: 200 },
      { viewer_id: "viewer_2", creator_id: "creator_a", outcome_label: "Yes", points: 100 },
      { viewer_id: "viewer_3", creator_id: "creator_a", outcome_label: "No", points: 150 },
    ],
  ],
  [
    "prediction_locked_1",
    [
      { viewer_id: "viewer_4", creator_id: "creator_a", outcome_label: "Yes", points: 100 },
      { viewer_id: "viewer_5", creator_id: "creator_a", outcome_label: "No", points: 50 },
    ],
  ],
]);
