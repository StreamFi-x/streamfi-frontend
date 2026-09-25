export type AccountDeletionStatus = "pending" | "deleted" | "cancelled";

export interface AccountDeletionRequest {
  user_id: string;
  status: AccountDeletionStatus;
  requested_at: string;
  scheduled_for: string;
  cancelled_at: string | null;
}

export interface AccountDeleteCancelBody {
  user_id: string;
}

export interface AccountDeleteCancelResponse {
  deletion_request: AccountDeletionRequest;
}
