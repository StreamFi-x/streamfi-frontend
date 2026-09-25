import { NextResponse } from "next/server";
import { handleMuxWebhook } from "@/lib/mux/webhook";
import {
  assetHandlers,
  liveStreamHandlers,
  liveStreamLogOnly,
} from "@/lib/mux/webhook-handlers";

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
 *
 * Signature verification and exactly-once processing (keyed on the Mux event
 * id) live in lib/mux/webhook.ts; the side effects in
 * lib/mux/webhook-handlers.ts.
 */

const handlers = {
  ...liveStreamHandlers,
  ...assetHandlers({ notifyOwner: false }),
};

export async function POST(req: Request) {
  try {
    return await handleMuxWebhook(req, {
      endpoint: "webhooks/mux",
      handlers,
      logOnly: liveStreamLogOnly,
      missingObjectIdError: "Invalid event",
    });
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
