/**
 * Mux Asset Webhook Handler (VOD Creation)
 *
 * POST /api/routes-f/webhooks-mux-asset
 *
 * Handles Mux video.asset.* events for VOD (Video on Demand) creation.
 * This is a focused webhook handler specifically for asset events,
 * complementing the main /api/webhooks/mux handler for live stream events.
 *
 * Verifies Mux webhook signature to ensure authenticity and applies each
 * event at most once (keyed on the Mux event id) — see lib/mux/webhook.ts.
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
import { createRateLimiter } from "@/lib/rate-limit";
import { handleMuxWebhook } from "@/lib/mux/webhook";
import {
  assetDeletedHandler,
  assetHandlers,
  assetLogOnly,
} from "@/lib/mux/webhook-handlers";

// Rate limiter: max 120 requests per minute (Mux can send bursts)
const isRateLimited = createRateLimiter(60 * 1000, 120);

const handlers = {
  ...assetHandlers({ notifyOwner: true }),
  "video.asset.deleted": assetDeletedHandler,
};

export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (await isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    return await handleMuxWebhook(req, {
      endpoint: "routes-f/webhooks-mux-asset",
      handlers,
      logOnly: assetLogOnly,
      missingObjectIdError: "Invalid event: missing asset ID",
    });
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
