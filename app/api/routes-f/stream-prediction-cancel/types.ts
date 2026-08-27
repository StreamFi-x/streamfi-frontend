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
  cancelled_at: string | null;
}

/** A single viewer's channel-points stake on one of a prediction's outcomes. */
export interface PredictionStake {
  viewer_id: string;
  creator_id: string;
  outcome_label: string;
  points: number;
}

export interface CancelPredictionBody {
  prediction_id: string;
  moderator_id: string;
}

export interface RefundedStake {
  viewer_id: string;
  points_refunded: number;
}

export interface CancelPredictionResponse {
  prediction: Prediction;
  refunds: RefundedStake[];
}
