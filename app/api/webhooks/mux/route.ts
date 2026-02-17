import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * Mux Webhook Handler
 * Automatically detects when streams go live or offline
 *
 * Setup Instructions:
 * 1. Go to Mux Dashboard → Settings → Webhooks
 * 2. Add webhook URL: https://yourdomain.com/api/webhooks/mux
 * 3. Select events: video.live_stream.active, video.live_stream.idle
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
        try {
          const userResult = await sql`
            SELECT id, mux_playback_id, creator FROM users WHERE mux_stream_id = ${streamId}
          `;

          if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            const streamTitle =
              user.creator?.title || user.creator?.streamTitle || "Live Stream";

            await sql`
              INSERT INTO stream_sessions (user_id, title, playback_id, started_at, mux_session_id)
              VALUES (${user.id}, ${streamTitle}, ${user.mux_playback_id}, CURRENT_TIMESTAMP, ${streamId})
            `;
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
      "video.live_stream.idle",
      "video.live_stream.created",
      "video.live_stream.deleted",
    ],
  });
}
