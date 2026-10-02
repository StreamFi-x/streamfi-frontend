export interface AwardManualBody {
  moderator_id: string;
  viewer_id: string;
  creator_id: string;
  amount: number;
  reason: string;
}

export interface AwardRecord {
  award_id: string;
  moderator_id: string;
  viewer_id: string;
  creator_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

export interface AwardManualResponse {
  award_id: string;
  viewer_id: string;
  creator_id: string;
  amount: number;
  reason: string;
  new_balance: number;
  created_at: string;
}
