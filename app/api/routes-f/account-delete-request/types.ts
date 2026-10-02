export type AccountDeletionStatus = "pending" | "cancelled" | "completed";

export interface AccountDeletionRequest {
  user_id: string;
  status: AccountDeletionStatus;
  requested_at: string;
  scheduled_deletion_at: string;
}

export interface AccountDeleteRequestBody {
  user_id: string;
  reason?: string;
}

export interface AccountDeleteRequestResponse {
  deletion_request: AccountDeletionRequest;
  grace_period_days: number;
}
