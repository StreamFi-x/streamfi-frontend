/**
 * Mux Asset Webhook Handler (VOD Creation)
 * 
 * POST /api/routes-f/webhooks-mux-asset
 * 
 * Handles Mux video.asset.* events for VOD (Video on Demand) creation.
 * This is a focused webhook handler specifically for asset events,
 * complementing the main /api/webhooks/mux handler for live stream events.
 * 
 * Verifies Mux webhook signature to ensure authenticity.
 * 
 * Events handled:
 * - video.asset.ready: Asset is ready for playback (save to database)
 * - video.asset.created: Asset creation started (log only)
 * - video.asset.errored: Asset processing failed (mark as error)
 * - video.asset.deleted: Asset deleted (remove from database)
 * 
 * Setup Instructions:
 * 1. Go to Mux Dashboard → Settings → Webhooks
 * 2. Add webhook URL: https://yourdomain.com/api/routes-f/webhooks-mux-asset
 * 3. Copy the signing secret into MUX_WEBHOOK_SECRET env var
 * 4. Select asset events:
 *    - video.asset.created
 *    - video.asset.ready
 *    - video.asset.errored
 *    - video.asset.deleted
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createHmac, timingSafeEqual } from "crypto";
import { createRateLimiter } from "@/lib/rate-limit";
import { writeNotification } from "@/lib/notifications";

// Rate limiter: max 120 requests per minute (Mux can send bursts)
const isRateLimited = createRateLimiter(60 * 1000, 120);

/**
 * Verify the Mux-Signature header using HMAC-SHA256.
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

export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const rawBody = await req.text();
    const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
    const signatureHeader = req.headers.get("mux-signature");

    // Verify signature if secret is configured
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
    console.log("🔔 Mux asset webhook received:", event.type);

    const assetId = event.data?.id;
    if (!assetId) {
      console.error("❌ No asset ID in webhook event");
      return NextResponse.json(
        { error: "Invalid event: missing asset ID" },
        { status: 400 }
      );
    }

    switch (event.type) {
      // ── video.asset.created ──────────────────────────────────────────────
      // Asset creation has started (processing)
      case "video.asset.created": {
        console.log(`📹 Asset creation started: ${assetId}`);
        
        // Optionally track the asset as "processing" if it's linked to a stream
        // For now, we just log it and wait for the "ready" event
        break;
      }

      // ── video.asset.ready ────────────────────────────────────────────────
      // Asset is ready for playback - save to database
      case "video.asset.ready": {
        const playbackId = event.data?.playback_ids?.[0]?.id;
        const duration = event.data?.duration;
        const liveStreamId = event.data?.live_stream_id;

        if (!playbackId) {
          console.error(`❌ No playback ID for asset: ${assetId}`);
          break;
        }

        console.log(`✅ Asset ready: ${assetId} (playback: ${playbackId})`);

        try {
          let userId: string | null = null;
          let streamSessionId: string | null = null;
          let sessionTitle: string | null = "Stream Recording";

          // Try to find the user and session from the live stream ID
          if (liveStreamId) {
            const userResult = await sql`
              SELECT id, mux_playback_id, creator FROM users
              WHERE mux_stream_id = ${liveStreamId}
            `;

            if (userResult.rows.length > 0) {
              const u = userResult.rows[0];
              userId = u.id;
              sessionTitle =
                u.creator?.streamTitle ?? u.creator?.title ?? sessionTitle;

              // Find the most recent ended session for this user
              const sessionResult = await sql`
                SELECT id FROM stream_sessions
                WHERE user_id = ${u.id} AND ended_at IS NOT NULL
                ORDER BY ended_at DESC
                LIMIT 1
              `;

              if (sessionResult.rows.length > 0) {
                streamSessionId = sessionResult.rows[0].id;
              }
            }
          }

          if (!userId) {
            console.warn(
              `⚠️ video.asset.ready: could not resolve user for asset ${assetId}`
            );
            break;
          }

          // Insert new recording with needs_review=true so the owner is prompted
          // ON CONFLICT: update status/duration only — preserve needs_review if already dismissed
          await sql`
            INSERT INTO stream_recordings (
              user_id,
              stream_session_id,
              mux_asset_id,
              playback_id,
              title,
              duration,
              status,
              needs_review
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
              duration = COALESCE(EXCLUDED.duration, stream_recordings.duration),
              playback_id = EXCLUDED.playback_id
          `;

          console.log(`✅ Stream recording saved: ${assetId}`);

          // Send notification to user
          try {
            const durationMinutes = duration ? Math.floor(duration / 60) : 0;
            await writeNotification(
              userId,
              "live",
              "Recording Ready",
              `Your stream recording is ready (${durationMinutes} min). Review it now!`
            );
          } catch (notifError) {
            console.error("Failed to send recording notification:", notifError);
          }
        } catch (recErr) {
          console.error("❌ Failed to save stream recording:", recErr);
        }
        break;
      }

      // ── video.asset.errored ──────────────────────────────────────────────
      // Asset processing failed
      case "video.asset.errored": {
        console.error(`❌ Asset processing failed: ${assetId}`);

        try {
          const result = await sql`
            UPDATE stream_recordings
            SET status = 'error'
            WHERE mux_asset_id = ${assetId}
            RETURNING user_id
          `;

          if (result.rows.length > 0) {
            const userId = result.rows[0].user_id;
            
            // Notify user of the error
            try {
              await writeNotification(
                userId,
                "live",
                "Recording Failed",
                "We encountered an error processing your stream recording. Please contact support."
              );
            } catch (notifError) {
              console.error("Failed to send error notification:", notifError);
            }
          }

          console.log(`✅ Marked recording as error: ${assetId}`);
        } catch (updateErr) {
          console.error("❌ Failed to update recording status:", updateErr);
        }
        break;
      }

      // ── video.asset.deleted ──────────────────────────────────────────────
      // Asset was deleted (either by user or automatically)
      case "video.asset.deleted": {
        console.log(`🗑️ Asset deleted: ${assetId}`);

        try {
          await sql`
            DELETE FROM stream_recordings
            WHERE mux_asset_id = ${assetId}
          `;
          console.log(`✅ Recording removed from database: ${assetId}`);
        } catch (deleteErr) {
          console.error("❌ Failed to delete recording:", deleteErr);
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled asset event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Mux asset webhook handler error:", error);
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
    message: "Mux asset webhook endpoint is active",
    events: [
      "video.asset.created",
      "video.asset.ready",
      "video.asset.errored",
      "video.asset.deleted",
    ],
  });
}
