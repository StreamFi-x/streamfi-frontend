export type RedemptionStatus = "pending" | "approved" | "rejected";

export interface Redemption {
  redemption_id: string;
  viewer_id: string;
  creator_id: string;
  item_name: string;
  cost: number;
  status: RedemptionStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface RedemptionRejectBody {
  redemption_id: string;
  moderator_id: string;
  reason?: string;
}

export interface RedemptionRejectResponse {
  redemption: Redemption;
  refunded_amount: number;
  new_balance: number;
}
