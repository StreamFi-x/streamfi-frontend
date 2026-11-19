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
 * Verifies the Mux webhook signature to ensure authenticity and applies
 * each event at most once (keyed on the Mux event id) — see
 * lib/mux/webhook.ts.
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
import { createRateLimiter } from "@/lib/rate-limit";
import { handleMuxWebhook } from "@/lib/mux/webhook";
import {
  liveStreamHandlers,
  liveStreamLogOnly,
} from "@/lib/mux/webhook-handlers";

// Rate limiter: max 120 requests per minute (Mux can send bursts)
const isRateLimited = createRateLimiter(60 * 1000, 120);

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (await isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    return await handleMuxWebhook(req, {
      endpoint: "routes-f/webhooks-mux-live",
      handlers: liveStreamHandlers,
      logOnly: {
        "video.live_stream.connected":
          liveStreamLogOnly["video.live_stream.connected"],
        "video.live_stream.disconnected":
          liveStreamLogOnly["video.live_stream.disconnected"],
      },
      missingObjectIdError: "Invalid event: missing stream ID",
    });
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
