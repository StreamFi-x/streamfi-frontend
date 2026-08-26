export type RedemptionStatus = "pending" | "approved" | "rejected";

export interface RewardCatalogItem {
  reward_id: string;
  creator_id: string;
  name: string;
  cost: number;
}

export interface Redemption {
  redemption_id: string;
  viewer_id: string;
  creator_id: string;
  reward_id: string;
  reward_name: string;
  cost: number;
  status: RedemptionStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface RedeemBody {
  viewer_id: string;
  creator_id: string;
  reward_id: string;
}

export interface RedeemResponse {
  redemption: Redemption;
  new_balance: number;
}
