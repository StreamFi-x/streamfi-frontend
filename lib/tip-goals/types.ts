/**
 * Type definitions for tip-goal escrow system.
 */

export type TipGoalStatus =
  | "DRAFT"
  | "ACTIVE"
  | "GOAL_REACHED"
  | "RELEASING_FUNDS"
  | "RELEASED"
  | "DEADLINE_PASSED"
  | "REFUNDING"
  | "REFUND_COMPLETE";

export interface TipGoal {
  id: string;
  creator_id: string;
  stream_id: string | null;
  
  title: string;
  description: string | null;
  goal_amount_xlm: string; // NUMERIC as string
  current_amount_xlm: string;
  current_contributor_count: number;
  
  escrow_account_public_key: string;
  
  created_at: Date;
  expires_at: Date;
  
  status: TipGoalStatus;
  goal_reached_at: Date | null;
  release_completed_at: Date | null;
  refund_completed_at: Date | null;
  
  updated_at: Date;
}

export interface TipGoalContribution {
  id: string;
  goal_id: string;
  contributor_wallet: string;
  contributor_id: string | null;
  amount_xlm: string;
  tx_hash: string;
  
  refunded: boolean;
  refund_tx_hash: string | null;
  refund_attempted_at: Date | null;
  refund_attempt_count: number;
  refund_failed_reason: string | null;
  refund_next_retry_at: Date | null;
  
  created_at: Date;
  updated_at: Date;
}

export interface TipGoalProgressUpdate {
  goalId: string;
  currentAmountXlm: string;
  currentContributorCount: number;
  goalReached: boolean;
  percentComplete: number;
  message?: string;
}

export interface CreateTipGoalInput {
  creator_id: string;
  stream_id?: string | null;
  title: string;
  description?: string | null;
  goal_amount_xlm: string;
  deadline_minutes: number; // How many minutes from now until deadline
}

export interface RefundRetryConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  exponentialBase: number;
}

export const DEFAULT_REFUND_CONFIG: RefundRetryConfig = {
  maxRetries: 288, // 24 hours with 5-minute jobs
  initialBackoffMs: 1000,
  maxBackoffMs: 24 * 60 * 60 * 1000, // 24 hours
  exponentialBase: 2,
};
