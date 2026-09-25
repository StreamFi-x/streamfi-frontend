/**
 * Mux Live Stream Webhook Handler (#1550)
 *
 * POST /api/routes-f/webhooks-mux-live
 *
 * Handles Mux video.live_stream.* events. A focused, routes-f-scoped
 * handler for live-stream events — complementing the main
 * /api/webhooks/mux handler and /api/routes-f/webhooks-mux-asset (the
 * equivalent focused handler for VOD asset events).
 *
 * Verifies the Mux webhook signature to ensure authenticity.
 *
 * Events handled:
 * - video.live_stream.active: stream is broadcasting — mark the user live,
 *   open a stream session
 * - video.live_stream.connected: encoder connected but not yet broadcasting
 *   — logged only, does not mark live (mirrors the main handler's
 *   reasoning: wait for "active")
 * - video.live_stream.disconnected: encoder dropped — logged only, does
 *   not mark offline (Mux holds the reconnect window; wait for "idle" to
 *   avoid flapping is_live on brief network blips)
 * - video.live_stream.idle: stream genuinely offline — mark the user
 *   offline, close the open stream session
 *
 * Setup Instructions:
 * 1. Go to Mux Dashboard → Settings → Webhooks
 * 2. Add webhook URL: https://yourdomain.com/api/routes-f/webhooks-mux-live
 * 3. Copy the signing secret into MUX_WEBHOOK_SECRET env var
 * 4. Select live stream events:
 *    - video.live_stream.active
 *    - video.live_stream.connected
 *    - video.live_stream.idle
 *    - video.live_stream.disconnected
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createHmac, timingSafeEqual } from "crypto";
import { createRateLimiter } from "@/lib/rate-limit";

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
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (await isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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
      console.warn(
        "⚠️  MUX_WEBHOOK_SECRET not set — skipping signature verification (set it in production)"
      );
    }

    const event = JSON.parse(rawBody);
    console.log("🔔 Mux live stream webhook received:", event.type);

    const streamId = event.data?.id;
    if (!streamId) {
      console.error("❌ No stream ID in webhook event");
      return NextResponse.json(
        { error: "Invalid event: missing stream ID" },
        { status: 400 }
      );
    }

    switch (event.type) {
      // ── video.live_stream.active ──────────────────────────────────────────
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

        try {
          const userResult = await sql`
            SELECT id, mux_playback_id, creator FROM users WHERE mux_stream_id = ${streamId}
          `;

          if (userResult.rows.length > 0) {
            const user = userResult.rows[0];

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

        console.log("✅ Stream marked as LIVE");
        break;
      }

      // ── video.live_stream.connected ───────────────────────────────────────
      // Encoder connected but not yet broadcasting — wait for "active".
      case "video.live_stream.connected":
        console.log(
          `🔌 Encoder connected (not yet live): ${streamId} — waiting for active event`
        );
        break;

      // ── video.live_stream.disconnected ────────────────────────────────────
      // Do NOT mark offline yet — Mux holds the slot for the reconnect
      // window; wait for "idle" to avoid flapping is_live on a brief blip.
      case "video.live_stream.disconnected":
        console.log(
          `⚠️ Encoder disconnected: ${streamId} — waiting for reconnect or idle event before marking offline`
        );
        break;

      // ── video.live_stream.idle ────────────────────────────────────────────
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

        console.log("✅ Stream marked as OFFLINE");
        break;
      }

      default:
        console.log(`ℹ️ Unhandled live stream event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Mux live stream webhook handler error:", error);
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
    message: "Mux live stream webhook endpoint is active",
    events: [
      "video.live_stream.active",
      "video.live_stream.connected",
      "video.live_stream.idle",
      "video.live_stream.disconnected",
    ],
  });
}
