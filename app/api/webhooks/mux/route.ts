import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * Mux Webhook Handler
 * Automatically detects when streams go live or offline
 *
 * Setup Instructions:
 * 1. Go to Mux Dashboard → Settings → Webhooks
 * 2. Add webhook URL: https://yourdomain.com/api/webhooks/mux
 * 3. Select events:
 *    - video.live_stream.active / video.live_stream.connected (stream goes live)
 *    - video.live_stream.idle / video.live_stream.disconnected (stream goes offline)
 *    - video.asset.ready (optional - for stream recording)
 */
export async function POST(req: Request) {
  try {
    const event = await req.json();

    console.log("🔔 Mux webhook received:", event.type);

    // Verify webhook signature (optional but recommended for production)
    // const signature = req.headers.get("mux-signature");
    // if (!verifyMuxSignature(signature, event)) {
    //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    // }

    const streamId = event.data?.id;

    if (!streamId) {
      console.error("❌ No stream ID in webhook event");
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    // Handle different event types
    switch (event.type) {
      case "video.live_stream.active":
      case "video.live_stream.connected":
        // Stream went live!
        console.log(`🔴 Stream going LIVE: ${streamId}`);

        await sql`
          UPDATE users SET
            is_live = true,
            stream_started_at = CURRENT_TIMESTAMP,
            current_viewers = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE mux_stream_id = ${streamId}
        `;

        // Create stream session record (optional - non-critical)
        // Mux fires both "connected" and "active" — only create one session.
        try {
          const userResult = await sql`
            SELECT id, mux_playback_id, creator FROM users WHERE mux_stream_id = ${streamId}
          `;

          if (userResult.rows.length > 0) {
            const user = userResult.rows[0];

            // Check if an active session already exists (prevents duplicates from connected+active)
            const existingSession = await sql`
              SELECT id FROM stream_sessions WHERE user_id = ${user.id} AND ended_at IS NULL LIMIT 1
            `;

            if (existingSession.rows.length === 0) {
              const streamTitle =
                user.creator?.title ||
                user.creator?.streamTitle ||
                "Live Stream";

              await sql`
                INSERT INTO stream_sessions (user_id, title, playback_id, started_at, mux_session_id)
                VALUES (${user.id}, ${streamTitle}, ${user.mux_playback_id}, CURRENT_TIMESTAMP, ${streamId})
              `;
              console.log("✅ New stream session created");
            } else {
              console.log(
                "⏭️ Active session already exists, skipping creation"
              );
            }
          }
        } catch (sessionError) {
          console.error(
            "⚠️ Failed to create stream session (non-critical):",
            sessionError instanceof Error
              ? sessionError.message
              : String(sessionError)
          );
          // Don't fail the webhook - the main is_live update succeeded
        }

        console.log(`✅ Stream marked as LIVE in database`);
        break;

      case "video.live_stream.idle":
      case "video.live_stream.disconnected":
        // Stream went offline
        console.log(`⚫ Stream going OFFLINE: ${streamId}`);

        await sql`
          UPDATE users SET
            is_live = false,
            stream_started_at = NULL,
            current_viewers = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE mux_stream_id = ${streamId}
        `;

        // End stream session
        try {
          const userResult = await sql`
            SELECT id FROM users WHERE mux_stream_id = ${streamId}
          `;

          if (userResult.rows.length > 0) {
            const user = userResult.rows[0];

            await sql`
              UPDATE stream_sessions SET
                ended_at = CURRENT_TIMESTAMP
              WHERE user_id = ${user.id} AND ended_at IS NULL
            `;
          }
        } catch (sessionError) {
          console.error("Failed to end stream session:", sessionError);
        }

        console.log(`✅ Stream marked as OFFLINE in database`);
        break;

      case "video.live_stream.created":
        console.log(`📺 New stream created: ${streamId}`);
        break;

      case "video.live_stream.deleted":
        console.log(`🗑️ Stream deleted: ${streamId}`);
        break;

      case "video.asset.ready": {
        const assetId = event.data?.id;
        const playbackIds = event.data?.playback_ids as Array<{ id?: string }> | undefined;
        const playbackId = Array.isArray(playbackIds) ? playbackIds[0]?.id : undefined;
        const duration = event.data?.duration != null ? Math.round(event.data.duration) : null;
        const liveStreamId = event.data?.live_stream_id ?? event.data?.live_stream?.id;

        if (!assetId || !playbackId) {
          console.error("❌ video.asset.ready missing asset id or playback_id", event.data);
          break;
        }

        try {
          let userId: string | null = null;
          let streamSessionId: string | null = null;
          let sessionTitle: string | null = "Stream Recording";

          if (liveStreamId) {
            const userResult = await sql`
              SELECT id, mux_playback_id, creator FROM users WHERE mux_stream_id = ${liveStreamId}
            `;
            if (userResult.rows.length > 0) {
              const u = userResult.rows[0];
              userId = u.id;
              sessionTitle = u.creator?.streamTitle ?? u.creator?.title ?? sessionTitle;
              const sessionResult = await sql`
                SELECT id FROM stream_sessions
                WHERE user_id = ${u.id} AND ended_at IS NOT NULL
                ORDER BY ended_at DESC LIMIT 1
              `;
              if (sessionResult.rows.length > 0) {
                streamSessionId = sessionResult.rows[0].id;
              }
            }
          }

          if (!userId) {
            console.warn("⚠️ video.asset.ready: could not resolve user for asset", assetId);
            break;
          }

          await sql`
            INSERT INTO stream_recordings (
              user_id, stream_session_id, mux_asset_id, playback_id, title, duration, status
            )
            VALUES (
              ${userId},
              ${streamSessionId},
              ${assetId},
              ${playbackId},
              ${sessionTitle},
              ${duration ?? 0},
              'ready'
            )
            ON CONFLICT (mux_asset_id) DO UPDATE SET
              status = 'ready',
              duration = COALESCE(EXCLUDED.duration, stream_recordings.duration)
          `;
          console.log(`✅ Stream recording saved: ${assetId}`);
        } catch (recErr) {
          console.error("❌ Failed to save stream recording:", recErr);
        }
        break;
      }

      case "video.asset.errored": {
        const erroredAssetId = event.data?.id;
        if (erroredAssetId) {
          try {
            await sql`
              UPDATE stream_recordings SET status = 'error' WHERE mux_asset_id = ${erroredAssetId}
            `;
            console.log(`✅ Marked recording as error: ${erroredAssetId}`);
          } catch (updateErr) {
            console.error("❌ Failed to update recording status:", updateErr);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Mux webhook endpoint is active",
    events: [
      "video.live_stream.active",
      "video.live_stream.connected",
      "video.live_stream.idle",
      "video.live_stream.disconnected",
      "video.live_stream.created",
      "video.live_stream.deleted",
    ],
  });
}
