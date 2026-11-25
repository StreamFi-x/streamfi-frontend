import { defaultExecutor } from "@/lib/db/executor";
import { writeNotification } from "@/lib/notifications";
import { markMuxStreamLive, markMuxStreamOffline } from "@/lib/mux/live-state";
import { upsertRecordingFromAsset } from "@/lib/mux/recordings";
import type {
  MuxEventHandler,
  MuxLogOnlyEvents,
  MuxWebhookEvent,
} from "@/lib/mux/webhook";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { dispatchJob } from "@/lib/jobs/qstash";
import { liveFanoutJob } from "@/lib/jobs/definitions/live-fanout";
import { streamOfflineCleanupJob } from "@/lib/jobs/definitions/stream-offline-cleanup";
import { publishRealtimeMessage } from "@/lib/realtime/pubsub";
import { logger } from "@/lib/logger";

/**
 * Side-effecting Mux event handlers. Each runs inside the transaction opened
 * by processMuxEventOnce, so any error rolls back both the side effects and
 * the idempotency claim and the event is retried on Mux's next delivery.
 * Errors must therefore propagate — never swallow them here.
 */

const streamId = (event: MuxWebhookEvent) => event.data.id as string;

// is_live is part of the cached public profile (docs/caching-policy.md).
async function invalidateUsers(userIds: string[]): Promise<void> {
  for (const id of userIds) {
    await invalidateUserCaches({ id });
  }
}

/**
 * Enqueue (after the live-state transaction commits) the async fan-out of
 * "go live" notifications to every follower of each streamer (#1138). Runs
 * outside the transaction so the webhook returns promptly; the queued job
 * pages through the follower graph in batches and is idempotent per
 * (creator, stream-session), so a webhook ↔ /api/streams/start race enqueues
 * a single fan-out rather than two.
 */
async function dispatchLiveFanout(creatorIds: string[]): Promise<void> {
  for (const creatorId of creatorIds) {
    try {
      const { rows } = await defaultExecutor(
        `SELECT id FROM stream_sessions
          WHERE user_id = $1 AND ended_at IS NULL
          ORDER BY started_at DESC LIMIT 1`,
        [creatorId]
      );
      const streamSessionId = (rows[0]?.id as string | undefined) ?? null;
      const result = await dispatchJob(
        liveFanoutJob,
        { creatorId, streamSessionId },
        {
          deduplicationId: `live-fanout:${creatorId}:${new Date().toISOString().slice(0, 10)}`,
        }
      );
      if (!result.dispatched) {
        logger.warn("live-fanout not dispatched", {
          module: "mux/webhook-handlers",
          creatorId,
          reason: result.reason,
        });
      }
    } catch (err) {
      logger.error("live-fanout dispatch failed", err, {
        module: "mux/webhook-handlers",
        creatorId,
      });
    }
  }
}

export const liveStreamHandlers: Record<string, MuxEventHandler> = {
  // The stream is actively broadcasting. This is when we mark the user live.
  "video.live_stream.active": async (tx, event, afterCommit) => {
    const id = streamId(event);
    logger.info("Stream active (broadcasting)", {
      module: "mux/webhook-handlers",
      streamId: id,
    });
    const userIds = await markMuxStreamLive(tx, id);
    afterCommit?.(async () => {
      await invalidateUsers(userIds);
      await dispatchLiveFanout(userIds);
    });
    logger.info("Stream marked as live", {
      module: "mux/webhook-handlers",
      streamId: id,
    });
  },

  // Stream is genuinely offline (reconnect window elapsed).
  "video.live_stream.idle": async (tx, event, afterCommit) => {
    const id = streamId(event);
    logger.info("Stream offline (idle)", {
      module: "mux/webhook-handlers",
      streamId: id,
    });
    const users = await markMuxStreamOffline(tx, id);
    afterCommit?.(async () => {
      for (const user of users) {
        await invalidateUsers([user.id]);
        if (user.mux_playback_id !== null) {
          await publishRealtimeMessage(
            `stream:${user.mux_playback_id}:status`,
            "stream:ended",
            {
              playbackId: user.mux_playback_id,
              endedAt: new Date().toISOString(),
            }
          );
        }
        const result = await dispatchJob(
          streamOfflineCleanupJob,
          { userId: user.id },
          { deduplicationId: `stream-offline-cleanup:${user.id}` }
        );
        if (!result.dispatched) {
          logger.warn("stream-offline-cleanup not dispatched", {
            module: "mux/webhook-handlers",
            userId: user.id,
            reason: result.reason,
          });
        }
      }
    });
    logger.info("Stream marked as offline", {
      module: "mux/webhook-handlers",
      streamId: id,
    });
  },
};

export const liveStreamLogOnly: MuxLogOnlyEvents = {
  // Encoder connected but not yet broadcasting — wait for "active".
  "video.live_stream.connected": event =>
    logger.info("Encoder connected (waiting for active event)", {
      module: "mux/webhook-handlers",
      streamId: streamId(event),
    }),
  // Mux holds the slot for the reconnect window; wait for "idle" so a brief
  // network blip does not flap is_live.
  "video.live_stream.disconnected": event =>
    logger.info("Encoder disconnected (waiting for reconnect or idle event)", {
      module: "mux/webhook-handlers",
      streamId: streamId(event),
    }),
  "video.live_stream.created": event =>
    logger.info("New stream created", {
      module: "mux/webhook-handlers",
      streamId: streamId(event),
    }),
  "video.live_stream.deleted": event =>
    logger.info("Stream deleted", {
      module: "mux/webhook-handlers",
      streamId: streamId(event),
    }),
};

interface AssetHandlerOptions {
  /** Send the owner an in-app notification when the recording is ready/failed. */
  notifyOwner: boolean;
}

export function assetHandlers({
  notifyOwner,
}: AssetHandlerOptions): Record<string, MuxEventHandler> {
  return {
    "video.asset.ready": async (tx, event) => {
      const data = event.data as {
        id: string;
        playback_ids?: Array<{ id?: string }>;
        duration?: number | null;
        live_stream_id?: string;
        live_stream?: { id?: string };
        created_at?: string | number;
      };
      const assetId = data.id;
      const playbackId = Array.isArray(data.playback_ids)
        ? data.playback_ids[0]?.id
        : undefined;
      const duration =
        data.duration !== null && data.duration !== undefined
          ? Math.round(data.duration)
          : null;
      const liveStreamId = data.live_stream_id ?? data.live_stream?.id;

      if (!playbackId) {
        logger.error("video.asset.ready missing playback_id", undefined, {
          module: "mux/webhook-handlers",
          assetId,
        });
        return;
      }

      let userId: string | null = null;
      let streamSessionId: string | null = null;
      let title = "Stream Recording";

      if (liveStreamId) {
        const userResult = await tx.sql`
          SELECT id, creator FROM users WHERE mux_stream_id = ${liveStreamId}
        `;
        if (userResult.rows.length > 0) {
          const u = userResult.rows[0];
          userId = u.id;
          title = u.creator?.streamTitle ?? u.creator?.title ?? title;

          // Correlate with session that does not already have an attached recording,
          // matching closest in time to asset creation.
          const createdAtRaw =
            data.created_at ??
            (event as { created_at?: string | number }).created_at;
          const createdAtNum =
            typeof createdAtRaw === "number"
              ? createdAtRaw
              : Number(createdAtRaw);
          const assetCreatedAtIso =
            !isNaN(createdAtNum) && createdAtNum > 0
              ? new Date(
                  createdAtNum < 1e11 ? createdAtNum * 1000 : createdAtNum
                ).toISOString()
              : new Date().toISOString();

          const sessionResult = await tx.sql`
            SELECT id FROM stream_sessions
            WHERE user_id = ${u.id}
              AND id NOT IN (
                SELECT stream_session_id FROM stream_recordings WHERE stream_session_id IS NOT NULL
              )
            ORDER BY 
              CASE 
                WHEN ended_at IS NOT NULL THEN ABS(EXTRACT(EPOCH FROM (ended_at - ${assetCreatedAtIso}::timestamptz)))
                ELSE ABS(EXTRACT(EPOCH FROM (started_at - ${assetCreatedAtIso}::timestamptz)))
              END ASC
            LIMIT 1
          `;
          streamSessionId = sessionResult.rows[0]?.id ?? null;
        }
      }

      if (!userId) {
        logger.warn("video.asset.ready could not resolve user for asset", {
          module: "mux/webhook-handlers",
          assetId,
        });
        return;
      }

      await upsertRecordingFromAsset(
        {
          userId,
          streamSessionId,
          assetId,
          playbackId,
          title,
          duration,
        },
        tx
      );
      logger.info("Stream recording saved", {
        module: "mux/webhook-handlers",
        assetId,
        userId,
      });

      if (notifyOwner) {
        const minutes = duration ? Math.floor(duration / 60) : 0;
        await writeNotification(
          userId,
          "live",
          "Recording Ready",
          `Your stream recording is ready (${minutes} min). Review it now!`,
          tx
        );
      }
    },

    "video.asset.errored": async (tx, event) => {
      const assetId = event.data.id as string;
      const { rows } = await tx.sql`
        UPDATE stream_recordings SET status = 'error'
        WHERE mux_asset_id = ${assetId}
        RETURNING user_id
      `;
      logger.info("Marked recording as error", {
        module: "mux/webhook-handlers",
        assetId,
      });

      if (notifyOwner && rows.length > 0) {
        await writeNotification(
          rows[0].user_id,
          "live",
          "Recording Failed",
          "We encountered an error processing your stream recording. Please contact support.",
          tx
        );
      }
    },
  };
}

export const assetDeletedHandler: MuxEventHandler = async (tx, event) => {
  const assetId = event.data.id as string;
  await tx.sql`DELETE FROM stream_recordings WHERE mux_asset_id = ${assetId}`;
  logger.info("Recording removed from database", {
    module: "mux/webhook-handlers",
    assetId,
  });
};

/**
 * Handle video.clip.ready webhook event - marks clips as ready for playback
 */
export const clipReadyHandler: MuxEventHandler = async (tx, event) => {
  const clipAssetId = event.data.id as string;
  const clipPlaybackIds = event.data.playback_ids as
    | Array<{ id?: string }>
    | undefined;
  const clipPlaybackId = Array.isArray(clipPlaybackIds)
    ? clipPlaybackIds[0]?.id
    : undefined;

  if (!clipPlaybackId) {
    logger.error("video.clip.ready missing playback_id", undefined, {
      module: "mux/webhook-handlers",
      clipAssetId,
    });
    return;
  }

  try {
    // Find and update the clip record by mux_asset_id
    const clipResult = await tx.sql`
      SELECT id, streamer_id FROM stream_clips WHERE mux_asset_id = ${clipAssetId}
    `;

    if (clipResult.rows.length === 0) {
      logger.warn("video.clip.ready clip record not found", {
        module: "mux/webhook-handlers",
        clipAssetId,
      });
      return;
    }

    await tx.sql`
      UPDATE stream_clips SET
        playback_id = ${clipPlaybackId},
        status = 'ready',
        updated_at = CURRENT_TIMESTAMP
      WHERE mux_asset_id = ${clipAssetId}
    `;

    logger.info("Clip ready and playback enabled", {
      module: "mux/webhook-handlers",
      clipAssetId,
    });
  } catch (clipErr) {
    logger.error("Failed to update clip status", clipErr, {
      module: "mux/webhook-handlers",
      clipAssetId,
    });
  }
};

export const assetLogOnly: MuxLogOnlyEvents = {
  "video.asset.created": event =>
    logger.info("Asset creation started", {
      module: "mux/webhook-handlers",
      assetId: event.data.id,
    }),
};
