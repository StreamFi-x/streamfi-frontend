export type PredictionStatus = "open" | "locked" | "resolved" | "cancelled";

export interface PredictionOutcome {
  label: string;
  points: number;
}

export interface Prediction {
  prediction_id: string;
  stream_id: string;
  question: string;
  outcomes: PredictionOutcome[];
  status: PredictionStatus;
  created_at: string;
  locked_at: string | null;
  locked_by: string | null;
}

export interface LockPredictionBody {
  prediction_id: string;
  moderator_id: string;
}

export interface LockPredictionResponse {
  prediction: Prediction;
}
