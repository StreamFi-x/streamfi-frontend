import type { AccountDeletionRequest } from "./types";

// Keyed by user_id. The grace period is 30 days from requested_at.
export const deletionRequestStore = new Map<string, AccountDeletionRequest>([
  [
    "user-1",
    {
      user_id: "user-1",
      status: "pending",
      requested_at: "2026-08-10T00:00:00.000Z",
      scheduled_for: "2026-09-09T00:00:00.000Z",
      cancelled_at: null,
    },
  ],
  [
    "user-2",
    {
      user_id: "user-2",
      status: "pending",
      requested_at: "2026-08-20T00:00:00.000Z",
      scheduled_for: "2026-09-19T00:00:00.000Z",
      cancelled_at: null,
    },
  ],
  [
    "user-3",
    {
      user_id: "user-3",
      status: "deleted",
      requested_at: "2026-07-01T00:00:00.000Z",
      scheduled_for: "2026-07-31T00:00:00.000Z",
      cancelled_at: null,
    },
  ],
  [
    "user-4",
    {
      user_id: "user-4",
      status: "cancelled",
      requested_at: "2026-07-15T00:00:00.000Z",
      scheduled_for: "2026-08-14T00:00:00.000Z",
      cancelled_at: "2026-07-20T00:00:00.000Z",
    },
  ],
]);
