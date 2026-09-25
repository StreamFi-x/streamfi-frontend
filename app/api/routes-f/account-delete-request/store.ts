import type { AccountDeletionRequest } from "./types";
import { deletionRequestStore } from "./seedData";

export const GRACE_PERIOD_DAYS = 14;

export class DeletionAlreadyPendingError extends Error {}

export function requestAccountDeletion(
  userId: string
): AccountDeletionRequest {
  const existing = deletionRequestStore.get(userId);
  if (existing && existing.status === "pending") {
    throw new DeletionAlreadyPendingError(
      `account deletion is already pending for user '${userId}'`
    );
  }

  const requestedAt = new Date();
  const scheduledDeletionAt = new Date(requestedAt);
  scheduledDeletionAt.setUTCDate(
    scheduledDeletionAt.getUTCDate() + GRACE_PERIOD_DAYS
  );

  const request: AccountDeletionRequest = {
    user_id: userId,
    status: "pending",
    requested_at: requestedAt.toISOString(),
    scheduled_deletion_at: scheduledDeletionAt.toISOString(),
  };

  deletionRequestStore.set(userId, request);
  return request;
}
