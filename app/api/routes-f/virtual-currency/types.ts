export interface BitsPackage {
  id: string;
  name: string;
  bits: number;
  price_usd: number;
  discount_percent?: number;
  badge?: string;
}

export interface BitsBalance {
  user_id: string;
  available_bits: number;
  lifetime_purchased: number;
  lifetime_spent: number;
  updated_at: string;
}

export type TransactionType = "purchase" | "cheer" | "payout" | "refund" | "account_closure_disposition";

export interface BitsLedgerEntry {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number; // positive for credit, negative for debit
  balance_after: number;
  reference_id: string;
  notes?: string;
  created_at: string;
}

export interface CheerRequest {
  creator_id: string;
  amount_bits: number;
  message?: string;
}

export interface CheerEvent {
  cheer_id: string;
  viewer_id: string;
  creator_id: string;
  amount_bits: number;
  badge_tier: string;
  message?: string;
  created_at: string;
}

export interface CreatorEarnings {
  creator_id: string;
  accumulated_bits: number;
  equivalent_usd: number;
  total_paid_out_usd: number;
  updated_at: string;
}

export interface PayoutBatch {
  payout_id: string;
  creator_id: string;
  bits_redeemed: number;
  amount_usd: number;
  destination_wallet?: string;
  status: "pending" | "completed";
  created_at: string;
}

export interface AccountDispositionResult {
  user_id: string;
  unused_bits: number;
  status: "refund_processed" | "forfeited_per_policy" | "zero_balance";
  message: string;
}
