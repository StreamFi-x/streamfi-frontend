import type { AccountDeletionRequest } from "./types";
import { deletionRequestStore } from "./seedData";

export class DeletionRequestNotFoundError extends Error {}
export class DeletionNotPendingError extends Error {}

/**
 * Cancel a pending account deletion while it is still within its grace
 * period (status === "pending"). Once the account has actually been
 * deleted, or the deletion was already cancelled, this is a no-op error.
 */
export function cancelAccountDeletion(userId: string): AccountDeletionRequest {
  const request = deletionRequestStore.get(userId);
  if (!request) {
    throw new DeletionRequestNotFoundError(
      `no deletion request found for user '${userId}'`
    );
  }
  if (request.status !== "pending") {
    throw new DeletionNotPendingError(
      `deletion request for user '${userId}' is already ${request.status}`
    );
  }

  const updated: AccountDeletionRequest = {
    ...request,
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
  };
  deletionRequestStore.set(userId, updated);

  return updated;
}
