import { defaultExecutor } from "@/lib/db/executor";
import { writeNotification } from "@/lib/notifications";
import { markMuxStreamLive, markMuxStreamOffline } from "@/lib/mux/live-state";
import { upsertRecordingFromAsset } from "@/lib/mux/recordings";
import { resolveRecordingSession } from "@/lib/mux/recording-attribution";
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
        console.warn(
          `[mux] live-fanout not dispatched for ${creatorId} (${result.reason})`
        );
      }
    } catch (err) {
      console.error(
        `[mux] live-fanout dispatch failed for ${creatorId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

export const liveStreamHandlers: Record<string, MuxEventHandler> = {
  // The stream is actively broadcasting. This is when we mark the user live.
  "video.live_stream.active": async (tx, event, afterCommit) => {
    console.log(`🔴 Stream ACTIVE (broadcasting): ${streamId(event)}`);
    const userIds = await markMuxStreamLive(tx, streamId(event));
    afterCommit?.(async () => {
      await invalidateUsers(userIds);
      await dispatchLiveFanout(userIds);
    });
    console.log("✅ Stream marked as LIVE");
  },

  // Stream is genuinely offline (reconnect window elapsed).
  "video.live_stream.idle": async (tx, event, afterCommit) => {
    console.log(`⚫ Stream OFFLINE (idle): ${streamId(event)}`);
    const users = await markMuxStreamOffline(tx, streamId(event));
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
          console.warn(
            `[mux] stream-offline-cleanup not dispatched for ${user.id} (${result.reason})`
          );
        }
      }
    });
    console.log("✅ Stream marked as OFFLINE");
  },
};

export const liveStreamLogOnly: MuxLogOnlyEvents = {
  // Encoder connected but not yet broadcasting — wait for "active".
  "video.live_stream.connected": event =>
    console.log(
      `🔌 Encoder connected (not yet live): ${streamId(event)} — waiting for active event`
    ),
  // Mux holds the slot for the reconnect window; wait for "idle" so a brief
  // network blip does not flap is_live.
  "video.live_stream.disconnected": event =>
    console.log(
      `⚠️ Encoder disconnected: ${streamId(event)} — waiting for reconnect or idle event before marking offline`
    ),
  "video.live_stream.created": event =>
    console.log(`📺 New stream created: ${streamId(event)}`),
  "video.live_stream.deleted": event =>
    console.log(`🗑️ Stream deleted: ${streamId(event)}`),
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
        passthrough?: string | null;
        created_at?: string | number | null;
      };
      const assetId = data.id;
      const playbackId = Array.isArray(data.playback_ids)
        ? data.playback_ids[0]?.id
        : undefined;
      const duration =
        data.duration !== null && data.duration !== undefined
          ? Math.round(data.duration)
          : null;
      const liveStreamId = data.live_stream_id ?? data.live_stream?.id ?? null;
      const passthrough = data.passthrough ?? null;
      const assetCreatedAt = data.created_at ?? event.created_at ?? null;

      if (!playbackId) {
        console.error(`❌ video.asset.ready missing playback_id: ${assetId}`);
        return;
      }

      const resolution = await resolveRecordingSession(tx, {
        assetId,
        liveStreamId,
        playbackId,
        passthrough,
        assetCreatedAt,
      });

      const userId = resolution.userId;
      const streamSessionId = resolution.streamSessionId;
      const title = resolution.title ?? "Stream Recording";

      if (!userId) {
        console.warn(
          `⚠️ video.asset.ready: could not resolve user for asset ${assetId}`
        );
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
      console.log(
        `✅ Stream recording saved: ${assetId} (session: ${streamSessionId ?? "none"}, method: ${resolution.method})`
      );

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

    "video.upload.asset_created": async (tx, event) => {
      const data = event.data as {
        id: string;
        asset_id?: string;
        playback_ids?: Array<{ id?: string }>;
        passthrough?: string | null;
        new_asset_settings?: { passthrough?: string | null };
        created_at?: string | number | null;
      };
      const assetId = data.asset_id ?? data.id;
      const passthrough =
        data.passthrough ?? data.new_asset_settings?.passthrough ?? null;
      const playbackId = Array.isArray(data.playback_ids)
        ? data.playback_ids[0]?.id
        : undefined;
      const assetCreatedAt = data.created_at ?? event.created_at ?? null;

      const resolution = await resolveRecordingSession(tx, {
        assetId,
        passthrough,
        playbackId,
        assetCreatedAt,
      });

      console.log(
        `📹 video.upload.asset_created: asset ${assetId} attributed to session ${resolution.streamSessionId ?? "none"} via ${resolution.method}`
      );

      if (resolution.userId && playbackId) {
        await upsertRecordingFromAsset(
          {
            userId: resolution.userId,
            streamSessionId: resolution.streamSessionId,
            assetId,
            playbackId,
            title: resolution.title ?? "Stream Recording",
            duration: null,
          },
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
      console.log(`✅ Marked recording as error: ${assetId}`);

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
  console.log(`✅ Recording removed from database: ${assetId}`);
};

export const assetLogOnly: MuxLogOnlyEvents = {
  "video.asset.created": event =>
    console.log(`📹 Asset creation started: ${event.data.id}`),
};
