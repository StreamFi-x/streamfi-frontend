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
  resolved_at: string | null;
  winning_outcome: string | null;
}

/** A single viewer's channel-points stake on one of a prediction's outcomes. */
export interface PredictionStake {
  viewer_id: string;
  creator_id: string;
  outcome_label: string;
  points: number;
}

export interface ResolvePredictionBody {
  prediction_id: string;
  moderator_id: string;
  winningOutcome: string;
}

export interface Payout {
  viewer_id: string;
  points_staked: number;
  points_paid: number;
}

export interface ResolvePredictionResponse {
  prediction: Prediction;
  payouts: Payout[];
}
