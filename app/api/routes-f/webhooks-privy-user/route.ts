/**
 * POST /api/routes-f/webhooks-privy-user
 *
 * Receives Privy user lifecycle events (user.created, user.updated,
 * user.linked_account.created, user.wallet.created, ...) and syncs the
 * affected user record. Called by Privy's servers, not by an authenticated
 * end user, so this route verifies Privy's svix-based webhook signature
 * instead of using verifySession — see _lib/verify-signature.ts.
 *
 * Setup:
 * 1. In the Privy dashboard, configure a webhook endpoint pointing at
 *    this route and select the user.* events to send.
 * 2. Copy the signing secret (starts with "whsec_") into the
 *    PRIVY_WEBHOOK_SECRET env var.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getPrivySignatureHeaders,
  verifyPrivyWebhookSignature,
} from "./_lib/verify-signature";
import { processedEventIds, upsertPrivyUser } from "./store";
import type { PrivyWebhookEvent, PrivyWebhookResponse } from "./types";

const HANDLED_EVENT_TYPES = new Set([
  "user.created",
  "user.updated",
  "user.linked_account.created",
  "user.wallet.created",
]);

function isPrivyWebhookEvent(value: unknown): value is PrivyWebhookEvent {
  if (typeof value !== "object" || value === null) {return false;}
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string") {return false;}
  if (typeof v.user !== "object" || v.user === null) {return false;}
  const user = v.user as Record<string, unknown>;
  return typeof user.id === "string" && user.id.length > 0;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.PRIVY_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[webhooks-privy-user] PRIVY_WEBHOOK_SECRET not configured — refusing to process webhook"
    );
    return NextResponse.json(
      { error: "Webhook receiver not configured" },
      { status: 500 }
    );
  }

  const rawBody = await req.text();
  const headers = getPrivySignatureHeaders(req);

  const verification = verifyPrivyWebhookSignature(headers, rawBody, secret);
  if (!verification.valid) {
    console.error(`[webhooks-privy-user] signature verification failed: ${verification.reason}`);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPrivyWebhookEvent(parsed)) {
    return NextResponse.json(
      { error: "Malformed event: expected { type: string, user: { id: string } }" },
      { status: 400 }
    );
  }

  // Idempotency: svix (and therefore Privy) may redeliver the same event.
  // svix-id uniquely identifies a single delivery attempt of a message.
  const eventId = headers.svixId as string;
  if (processedEventIds.has(eventId)) {
    return NextResponse.json(
      { received: true, event: parsed.type } satisfies PrivyWebhookResponse
    );
  }

  if (!HANDLED_EVENT_TYPES.has(parsed.type)) {
    // Unknown/unhandled event type — acknowledge so Privy doesn't retry,
    // but do nothing else. Mirrors the "default" branch in
    // webhooks-mux-asset for unhandled event types.
    console.log(`[webhooks-privy-user] unhandled event type: ${parsed.type}`);
    processedEventIds.add(eventId);
    return NextResponse.json(
      { received: true, event: parsed.type } satisfies PrivyWebhookResponse
    );
  }

  try {
    upsertPrivyUser(parsed.user);
  } catch (error) {
    console.error("[webhooks-privy-user] failed to sync user:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }

  processedEventIds.add(eventId);

  return NextResponse.json(
    { received: true, event: parsed.type } satisfies PrivyWebhookResponse
  );
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Privy user webhook endpoint is active",
    events: Array.from(HANDLED_EVENT_TYPES),
  });
}
