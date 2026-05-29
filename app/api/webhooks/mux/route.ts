import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * Mux Webhook Handler
 *
 * Setup Instructions:
 * 1. Go to Mux Dashboard → Settings → Webhooks
 * 2. Add webhook URL: https://yourdomain.com/api/webhooks/mux
 * 3. Copy the signing secret into MUX_WEBHOOK_SECRET env var
 * 4. Select events:
 *    - video.live_stream.active      (stream starts broadcasting)
 *    - video.live_stream.connected   (encoder connected — NOT yet live)
 *    - video.live_stream.idle        (stream paused / no feed)
 *    - video.live_stream.disconnected (encoder disconnected)
 *    - video.asset.ready             (recording ready)
 */

/**
 * Verify the Mux-Signature header.
 * Returns true if the payload is authentic, false otherwise.
 * If MUX_WEBHOOK_SECRET is not set, verification is skipped (dev only).
 */
function verifyMuxWebhookSignature(
  header: string,
  rawBody: string,
  secret: string
): boolean {
  // Header format: "t=<unix_ts>,v1=<hex_signature>"
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) {
      parts[k.trim()] = v.trim();
    }
  }

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) {
    return false;
  }

  // Reject events older than 5 minutes to prevent replay attacks
  const ageSeconds = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (ageSeconds > 300) {
    console.error(`❌ Mux webhook too old: ${ageSeconds}s`);
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
    const signatureHeader = req.headers.get("mux-signature");

    if (webhookSecret) {
      if (!signatureHeader) {
        console.error("❌ Missing Mux-Signature header");
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 401 }
        );
      }
      if (!verifyMuxWebhookSignature(signatureHeader, rawBody, webhookSecret)) {
        console.error("❌ Invalid Mux webhook signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    } else {
      // No secret configured — log a warning but allow in dev
      console.warn(
        "⚠️  MUX_WEBHOOK_SECRET not set — skipping signature verification (set it in production)"
      );
    }

    const event = JSON.parse(rawBody);
    console.log("🔔 Mux webhook received:", event.type);

    const streamId = event.data?.id;

    if (!streamId) {
      console.error("❌ No stream ID in webhook event");
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    switch (event.type) {
      // ── video.live_stream.active ──────────────────────────────────────────
      // The stream is actively broadcasting. This is when we mark the user live.
      case "video.live_stream.active": {
        console.log(`🔴 Stream ACTIVE (broadcasting): ${streamId}`);

        await sql`
          UPDATE users SET
            is_live = true,
            stream_started_at = CURRENT_TIMESTAMP,
            current_viewers = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE mux_stream_id = ${streamId}
        `;

        // Create stream session record — only one per broadcast
        try {
          const userResult = await sql`
            SELECT id, mux_playback_id, creator FROM users WHERE mux_stream_id = ${streamId}
          `;

          if (userResult.rows.length > 0) {
            const user = userResult.rows[0];

            // Dedup: skip if an active session already exists
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
        }

        console.log(`✅ Stream marked as LIVE`);
        break;
      }

      // ── video.live_stream.connected ───────────────────────────────────────
      // Encoder connected to Mux but the stream is NOT yet broadcasting.
      // Do NOT mark as live — wait for the "active" event.
      case "video.live_stream.connected":
        console.log(
          `🔌 Encoder connected (not yet live): ${streamId} — waiting for active event`
        );
        break;

      // ── video.live_stream.disconnected ────────────────────────────────────
      // The encoder dropped the connection (could be a brief network blip).
      // DO NOT mark offline — Mux holds the slot for reconnect_window (60s).
      // We wait for the "idle" event, which only fires after reconnect_window
      // elapses without reconnect. This prevents flapping is_live on every
      // network hiccup.
      case "video.live_stream.disconnected":
        console.log(
          `⚠️ Encoder disconnected: ${streamId} — waiting for reconnect or idle event before marking offline`
        );
        break;

      // ── video.live_stream.idle ────────────────────────────────────────────
      // Stream is genuinely offline (reconnect window elapsed).
      case "video.live_stream.idle": {
        console.log(`⚫ Stream OFFLINE (idle): ${streamId}`);

        await sql`
          UPDATE users SET
            is_live = false,
            stream_started_at = NULL,
            current_viewers = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE mux_stream_id = ${streamId}
        `;

        // End open stream session
        try {
          const userResult = await sql`
            SELECT id FROM users WHERE mux_stream_id = ${streamId}
          `;

          if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            await sql`
              UPDATE stream_sessions SET ended_at = CURRENT_TIMESTAMP
              WHERE user_id = ${user.id} AND ended_at IS NULL
            `;
          }
        } catch (sessionError) {
          console.error("Failed to end stream session:", sessionError);
        }

        console.log(`✅ Stream marked as OFFLINE`);
        break;
      }

      case "video.live_stream.created":
        console.log(`📺 New stream created: ${streamId}`);
        break;

      case "video.live_stream.deleted":
        console.log(`🗑️ Stream deleted: ${streamId}`);
        break;

      // ── video.asset.ready ─────────────────────────────────────────────────
      case "video.asset.ready": {
        const assetId = event.data?.id;
        const playbackIds = event.data?.playback_ids as
          | Array<{ id?: string }>
          | undefined;
        const playbackId = Array.isArray(playbackIds)
          ? playbackIds[0]?.id
          : undefined;
        const duration =
          event.data?.duration !== null && event.data?.duration !== undefined
            ? Math.round(event.data.duration)
            : null;
        const liveStreamId =
          event.data?.live_stream_id ?? event.data?.live_stream?.id;

        if (!assetId || !playbackId) {
          console.error(
            "❌ video.asset.ready missing asset id or playback_id",
            event.data
          );
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
              sessionTitle =
                u.creator?.streamTitle ?? u.creator?.title ?? sessionTitle;
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
            console.warn(
              "⚠️ video.asset.ready: could not resolve user for asset",
              assetId
            );
            break;
          }

          // Insert new recording with needs_review=true so the owner is prompted.
          // ON CONFLICT: update status/duration only — preserve needs_review in case
          // the user already dismissed or deleted the prompt.
          await sql`
            INSERT INTO stream_recordings (
              user_id, stream_session_id, mux_asset_id, playback_id,
              title, duration, status, needs_review
            )
            VALUES (
              ${userId},
              ${streamSessionId},
              ${assetId},
              ${playbackId},
              ${sessionTitle},
              ${duration ?? 0},
              'ready',
              true
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
