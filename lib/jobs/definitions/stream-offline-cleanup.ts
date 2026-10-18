import { defaultExecutor } from "@/lib/db/executor";
import { defineJob } from "../definition";
import { PermanentJobError } from "../errors";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StreamOfflineCleanupPayload {
  userId: string;
}

export const streamOfflineCleanupJob = defineJob<StreamOfflineCleanupPayload, void>({
  name: "stream-offline-cleanup",
  description:
    "Close open viewer rows for ended stream sessions and reset current_viewers for offline users",
  maxAttempts: 3,
  timeoutSeconds: 20,
  leaseSeconds: 30,
  parsePayload: (raw: unknown): StreamOfflineCleanupPayload => {
    const r = raw as { userId?: unknown } | null;
    const userId = r?.userId;
    if (typeof userId !== "string" || !UUID.test(userId)) {
      throw new PermanentJobError(
        "payload must be { userId: <uuid> }"
      );
    }
    return { userId };
  },
  run: async ({ payload }) => {
    // (a) Close viewer rows for already-ended sessions belonging to this user.
    await defaultExecutor(
      `UPDATE stream_viewers
          SET left_at = NOW()
        WHERE stream_session_id IN (
          SELECT id FROM stream_sessions
           WHERE user_id = $1 AND ended_at IS NOT NULL
        )
          AND left_at IS NULL`,
      [payload.userId]
    );

    // (b) Idempotent guard: reset current_viewers only when the user is
    //     confirmed offline, so a race with a new stream-start is harmless.
    await defaultExecutor(
      `UPDATE users
          SET current_viewers = 0
        WHERE id = $1 AND is_live = false`,
      [payload.userId]
    );

    return { status: "succeeded" };
  },
});
