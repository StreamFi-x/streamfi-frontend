import { defaultExecutor, type SqlExecutor } from "@/lib/db/executor";
import { writeNotification } from "@/lib/notifications";
import { shouldSendInAppNotification } from "@/lib/notifications/preferences";
import { defineJob } from "../definition";
import { PermanentJobError } from "../errors";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export interface LiveFanoutPayload {
  creatorId: string;
  streamSessionId: string | null;
}

export interface LiveFanoutDeps {
  executor?: SqlExecutor;
  writeNotification?: typeof writeNotification;
  shouldSendInAppNotification?: typeof shouldSendInAppNotification;
  /** Injected in tests to skip the inter-batch delay. */
  sleep?: (ms: number) => Promise<void>;
}

export function createLiveFanoutJob(deps: LiveFanoutDeps = {}) {
  return defineJob({
    name: "live-fanout",
    description:
      "Fan out 'stream just went live' notifications to all followers of a creator",
    maxAttempts: 4,
    timeoutSeconds: 50,
    leaseSeconds: 70,
    leaseKey: (payload: LiveFanoutPayload) =>
      `live-fanout:${payload.creatorId}:${payload.streamSessionId ?? "nosession"}`,
    parsePayload: (raw: unknown): LiveFanoutPayload => {
      const r = raw as { creatorId?: unknown; streamSessionId?: unknown } | null;
      const creatorId = r?.creatorId;
      if (typeof creatorId !== "string" || !UUID.test(creatorId)) {
        throw new PermanentJobError(
          "payload must be { creatorId: <uuid>, streamSessionId: <uuid> | null }"
        );
      }
      const streamSessionId = r?.streamSessionId ?? null;
      if (
        streamSessionId !== null &&
        (typeof streamSessionId !== "string" || !UUID.test(streamSessionId))
      ) {
        throw new PermanentJobError(
          "payload must be { creatorId: <uuid>, streamSessionId: <uuid> | null }"
        );
      }
      return {
        creatorId,
        streamSessionId: streamSessionId as string | null,
      };
    },
    run: async ({ payload, dispatch }) => {
      const executor = deps.executor ?? defaultExecutor;
      const _writeNotification = deps.writeNotification ?? writeNotification;
      const _shouldSend =
        deps.shouldSendInAppNotification ?? shouldSendInAppNotification;

      const batchSize = envInt("LIVE_FANOUT_BATCH_SIZE", 100);
      const delayMs = envInt("LIVE_FANOUT_BATCH_DELAY_MS", 100);
      const _sleep = deps.sleep ?? sleep;

      // Fetch the creator — throw permanently if they no longer exist.
      const creatorResult = await executor(
        `SELECT id, username FROM users WHERE id = $1`,
        [payload.creatorId]
      );
      const creator = creatorResult.rows[0] as
        | { id: string; username: string }
        | undefined;
      if (!creator) {
        throw new PermanentJobError(
          `creator ${payload.creatorId} not found`
        );
      }
      const username = creator.username ?? "A creator";

      // Claim or resume the fan-out record.
      await executor(
        `INSERT INTO live_fanout_jobs
           (id, creator_id, stream_session_id, status)
         VALUES (gen_random_uuid(), $1, $2, 'pending')
         ON CONFLICT (creator_id, stream_session_id) DO NOTHING`,
        [payload.creatorId, payload.streamSessionId]
      );

      const fanoutResult = await executor(
        `SELECT id, status, last_processed_follower_id, notified_count
           FROM live_fanout_jobs
          WHERE creator_id = $1 AND stream_session_id IS NOT DISTINCT FROM $2`,
        [payload.creatorId, payload.streamSessionId]
      );

      const fanout = fanoutResult.rows[0] as {
        id: string;
        status: string;
        last_processed_follower_id: string | null;
        notified_count: number;
      } | undefined;

      if (!fanout) {
        // Should never happen — we just inserted above.
        throw new Error("failed to read live_fanout_jobs row after insert");
      }

      // Idempotency: already completed → skip.
      if (fanout.status === "completed") {
        return { status: "succeeded", metrics: { skipped: 1 } };
      }

      const fanoutId = fanout.id;
      const cursor = fanout.last_processed_follower_id ?? "00000000-0000-0000-0000-000000000000";

      // Mark in-progress.
      await executor(
        `UPDATE live_fanout_jobs SET status = 'in_progress', updated_at = now() WHERE id = $1`,
        [fanoutId]
      );

      // Keyset-paginate through followers.
      const followersResult = await executor(
        `SELECT follower_id
           FROM user_follows
          WHERE followee_id = $1 AND follower_id > $2::uuid
          ORDER BY follower_id ASC
          LIMIT $3`,
        [payload.creatorId, cursor, batchSize]
      );

      const rows = followersResult.rows as { follower_id: string }[];
      const rowCount = rows.length;
      const lastId = rowCount > 0 ? rows[rowCount - 1].follower_id : cursor;

      let batchNotified = 0;
      for (const row of rows) {
        const shouldSend = await _shouldSend(row.follower_id, "live");
        if (shouldSend) {
          await _writeNotification(
            row.follower_id,
            "live",
            `${username} is live!`,
            `${username} just started streaming`
          );
          batchNotified++;
        }
      }

      // Throttle between batches.
      await _sleep(delayMs);

      // Persist progress.
      await executor(
        `UPDATE live_fanout_jobs
            SET last_processed_follower_id = $1,
                notified_count = notified_count + $2,
                updated_at = now()
          WHERE id = $3`,
        [lastId, batchNotified, fanoutId]
      );

      if (rowCount === batchSize) {
        // Full page → dispatch a continuation.
        const deduplicationId = `live-fanout:${payload.creatorId}:${payload.streamSessionId ?? "nosession"}:${lastId}`;
        const next = await dispatch(payload, { deduplicationId });
        return {
          status: "succeeded",
          metrics: {
            batch_size: rowCount,
            notified: batchNotified,
            continued: next.dispatched ? 1 : 0,
          },
        };
      }

      // Partial page → we've reached the end of the follower list.
      await executor(
        `UPDATE live_fanout_jobs
            SET status = 'completed', updated_at = now()
          WHERE id = $1`,
        [fanoutId]
      );

      return {
        status: "succeeded",
        metrics: {
          batch_size: rowCount,
          notified: batchNotified,
          continued: 0,
        },
      };
    },
  });
}

export const liveFanoutJob = createLiveFanoutJob();
