export interface PredictionOutcome {
  label: string;
  points: number;
}

export type PredictionStatus = "open" | "locked" | "resolved" | "cancelled";

export interface Prediction {
  prediction_id: string;
  stream_id: string;
  question: string;
  outcomes: PredictionOutcome[];
  lock_after_sec: number;
  status: PredictionStatus;
  created_at: string;
  locks_at: string;
}

export interface CreatePredictionBody {
  stream_id: string;
  question: string;
  outcomes: string[];
  lock_after_sec: number;
}

export interface CreatePredictionResponse {
  prediction_id: string;
  locks_at: string;
}
