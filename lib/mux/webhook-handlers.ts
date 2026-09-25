import { writeNotification } from "@/lib/notifications";
import { markMuxStreamLive, markMuxStreamOffline } from "@/lib/mux/live-state";
import type {
  MuxEventHandler,
  MuxLogOnlyEvents,
  MuxWebhookEvent,
} from "@/lib/mux/webhook";

/**
 * Side-effecting Mux event handlers. Each runs inside the transaction opened
 * by processMuxEventOnce, so any error rolls back both the side effects and
 * the idempotency claim and the event is retried on Mux's next delivery.
 * Errors must therefore propagate — never swallow them here.
 */

const streamId = (event: MuxWebhookEvent) => event.data.id as string;

export const liveStreamHandlers: Record<string, MuxEventHandler> = {
  // The stream is actively broadcasting. This is when we mark the user live.
  "video.live_stream.active": async (tx, event) => {
    console.log(`🔴 Stream ACTIVE (broadcasting): ${streamId(event)}`);
    await markMuxStreamLive(tx, streamId(event));
    console.log("✅ Stream marked as LIVE");
  },

  // Stream is genuinely offline (reconnect window elapsed).
  "video.live_stream.idle": async (tx, event) => {
    console.log(`⚫ Stream OFFLINE (idle): ${streamId(event)}`);
    await markMuxStreamOffline(tx, streamId(event));
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
        console.error(`❌ video.asset.ready missing playback_id: ${assetId}`);
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
          const sessionResult = await tx.sql`
            SELECT id FROM stream_sessions
            WHERE user_id = ${u.id} AND ended_at IS NOT NULL
            ORDER BY ended_at DESC LIMIT 1
          `;
          streamSessionId = sessionResult.rows[0]?.id ?? null;
        }
      }

      if (!userId) {
        console.warn(
          `⚠️ video.asset.ready: could not resolve user for asset ${assetId}`
        );
        return;
      }

      // needs_review=true prompts the owner. ON CONFLICT only refreshes
      // status/duration/playback so a dismissed prompt stays dismissed.
      await tx.sql`
        INSERT INTO stream_recordings (
          user_id, stream_session_id, mux_asset_id, playback_id,
          title, duration, status, needs_review
        )
        VALUES (
          ${userId}, ${streamSessionId}, ${assetId}, ${playbackId},
          ${title}, ${duration ?? 0}, 'ready', true
        )
        ON CONFLICT (mux_asset_id) DO UPDATE SET
          status = 'ready',
          duration = COALESCE(EXCLUDED.duration, stream_recordings.duration),
          playback_id = EXCLUDED.playback_id
      `;
      console.log(`✅ Stream recording saved: ${assetId}`);

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
