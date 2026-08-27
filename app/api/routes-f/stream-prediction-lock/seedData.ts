import type { Prediction } from "./types";

// Moderators authorized to lock a prediction, keyed by stream_id.
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
        { label: "Yes", points: 0 },
        { label: "No", points: 0 },
      ],
      status: "open",
      created_at: "2026-01-01T00:00:00.000Z",
      locked_at: null,
      locked_by: null,
    },
  ],
  [
    "prediction_open_2",
    {
      prediction_id: "prediction_open_2",
      stream_id: "stream_b",
      question: "Will the speedrun finish under 30 minutes?",
      outcomes: [
        { label: "Yes", points: 0 },
        { label: "No", points: 0 },
      ],
      status: "open",
      created_at: "2026-01-02T00:00:00.000Z",
      locked_at: null,
      locked_by: null,
    },
  ],
  [
    "prediction_already_locked",
    {
      prediction_id: "prediction_already_locked",
      stream_id: "stream_a",
      question: "Will the raid clear before midnight?",
      outcomes: [
        { label: "Yes", points: 0 },
        { label: "No", points: 0 },
      ],
      status: "locked",
      created_at: "2025-12-01T00:00:00.000Z",
      locked_at: "2025-12-01T01:00:00.000Z",
      locked_by: "mod_1",
    },
  ],
  [
    "prediction_resolved",
    {
      prediction_id: "prediction_resolved",
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
    },
  ],
]);
