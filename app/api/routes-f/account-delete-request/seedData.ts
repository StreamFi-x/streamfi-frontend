import type { AccountDeletionRequest } from "./types";

// Keyed by user_id. Only one deletion request may be in-flight per user.
export const deletionRequestStore = new Map<string, AccountDeletionRequest>([
  [
    "user_with_cancelled_request",
    {
      user_id: "user_with_cancelled_request",
      status: "cancelled",
      requested_at: "2025-12-01T00:00:00.000Z",
      scheduled_deletion_at: "2025-12-15T00:00:00.000Z",
    },
  ],
  [
    "user_with_pending_request",
    {
      user_id: "user_with_pending_request",
      status: "pending",
      requested_at: "2026-01-01T00:00:00.000Z",
      scheduled_deletion_at: "2026-01-15T00:00:00.000Z",
    },
  ],
]);
