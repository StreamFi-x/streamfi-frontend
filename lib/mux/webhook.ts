import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";
import { sendOperationalAlert } from "@/lib/security/alerts";
import { withTransaction, type Tx } from "@/lib/postgres-transaction";

/**
 * Shared Mux webhook pipeline used by every Mux webhook endpoint
 * (/api/webhooks/mux, /api/routes-f/webhooks-mux-live,
 * /api/routes-f/webhooks-mux-asset):
 *
 *   signature + freshness check  →  parse  →  exactly-once processing
 *
 * Exactly-once (#1397): each side-effecting event is claimed by inserting its
 * Mux event id into mux_webhook_events *inside the same transaction* as its
 * side effects. The primary key makes a second delivery of the same event
 * block on the first one's uncommitted row; once the first commits, the
 * second sees a processed row and acknowledges without re-running anything.
 * If processing throws, the transaction (claim included) rolls back, the
 * failure is recorded, and Mux's retry re-processes the event.
 */

export const MUX_SIGNATURE_TOLERANCE_SECONDS = 300;

/** Upper bound on how long a duplicate waits for an in-flight original. */
const CLAIM_LOCK_TIMEOUT = "10s";
const LOCK_NOT_AVAILABLE = "55P03";
const FAILURE_ALERT_ATTEMPTS = 3;

/**
 * Verify the Mux-Signature header ("t=<unix_ts>,v1=<hex_hmac>").
 * Rejects events signed more than 5 minutes from now. This freshness window
 * is complementary to the persistent event-id store, not a replacement: Mux
 * signs every delivery attempt afresh, so a legitimate retry hours later
 * passes this check and is caught by the idempotency store instead.
 */
export function verifyMuxWebhookSignature(
  header: string,
  rawBody: string,
  secret: string,
  nowMs: number = Date.now()
): boolean {
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

  const ageSeconds = Math.abs(nowMs / 1000 - parseInt(timestamp, 10));
  if (!(ageSeconds <= MUX_SIGNATURE_TOLERANCE_SECONDS)) {
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

export interface MuxWebhookEvent {
  /** Unique per event; identical across Mux's redeliveries of that event. */
  id: string;
  type: string;
  created_at?: string;
  data: Record<string, unknown> & { id?: string };
}

/**
 * `afterCommit` queues work that must only run once the event's transaction
 * has committed, such as cache invalidation: invalidating inside the
 * transaction would let a concurrent read re-cache the pre-commit row.
 */
export type MuxEventHandler = (
  tx: Tx,
  event: MuxWebhookEvent,
  afterCommit?: (task: () => Promise<void>) => void
) => Promise<void>;

export type MuxEventOutcome = "processed" | "duplicate";

function errorSummary(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 500);
}

async function recordFailure(
  event: MuxWebhookEvent,
  endpoint: string,
  err: unknown
): Promise<number | null> {
  try {
    const { rows } = await sql<{ attempts: number }>`
      INSERT INTO mux_webhook_events
        (event_id, event_type, object_id, endpoint, status, attempts,
         last_error, event_created_at)
      VALUES (
        ${event.id}, ${event.type}, ${event.data?.id ?? null}, ${endpoint},
        'failed', 1, ${errorSummary(err)}, ${event.created_at ?? null}
      )
      ON CONFLICT (event_id) DO UPDATE SET
        attempts   = mux_webhook_events.attempts + 1,
        last_error = EXCLUDED.last_error,
        updated_at = NOW()
      WHERE mux_webhook_events.status = 'failed'
      RETURNING attempts
    `;
    return rows[0]?.attempts ?? null;
  } catch (recordErr) {
    logger.error("mux_webhook_failure_record_failed", {
      event_id: event.id,
      errorMessage: errorSummary(recordErr),
    });
    return null;
  }
}

/**
 * Applies `handler` for `event` at most once across all deliveries and all
 * endpoints. Throws if processing failed (the caller must return a non-2xx
 * so Mux retries).
 */
export async function processMuxEventOnce(
  event: MuxWebhookEvent,
  endpoint: string,
  handler: MuxEventHandler
): Promise<MuxEventOutcome> {
  const afterCommit: (() => Promise<void>)[] = [];
  try {
    const outcome = await withTransaction(async tx => {
      await tx.sql`SELECT set_config('lock_timeout', ${CLAIM_LOCK_TIMEOUT}, true)`;
      const { rows } = await tx.sql`
        INSERT INTO mux_webhook_events
          (event_id, event_type, object_id, endpoint, status, attempts,
           event_created_at, processed_at)
        VALUES (
          ${event.id}, ${event.type}, ${event.data?.id ?? null}, ${endpoint},
          'processed', 1, ${event.created_at ?? null}, NOW()
        )
        ON CONFLICT (event_id) DO UPDATE SET
          status       = 'processed',
          attempts     = mux_webhook_events.attempts + 1,
          endpoint     = EXCLUDED.endpoint,
          last_error   = NULL,
          processed_at = NOW(),
          updated_at   = NOW()
        WHERE mux_webhook_events.status = 'failed'
        RETURNING attempts
      `;

      if (rows.length === 0) {
        logger.info("mux_webhook_duplicate", {
          event_id: event.id,
          event_type: event.type,
          endpoint,
        });
        return "duplicate" as const;
      }

      await handler(tx, event, task => afterCommit.push(task));
      return "processed" as const;
    });
    for (const task of afterCommit) {
      try {
        await task();
      } catch (taskErr) {
        // The event is committed; a failed follow-up must not trigger a retry.
        logger.error("mux_webhook_after_commit_failed", {
          event_id: event.id,
          errorMessage: errorSummary(taskErr),
        });
      }
    }
    return outcome;
  } catch (err) {
    if ((err as { code?: string } | null)?.code === LOCK_NOT_AVAILABLE) {
      // Another delivery of this event is still being processed. Nothing
      // failed; the non-2xx makes Mux retry once the original has finished.
      logger.warn("mux_webhook_in_flight_duplicate", {
        event_id: event.id,
        event_type: event.type,
        endpoint,
      });
      throw err;
    }
    const attempts = await recordFailure(event, endpoint, err);
    logger.error("mux_webhook_processing_failure", {
      event_id: event.id,
      event_type: event.type,
      endpoint,
      attempts,
      errorMessage: errorSummary(err),
    });
    if (attempts !== null && attempts >= FAILURE_ALERT_ATTEMPTS) {
      await sendOperationalAlert({
        category: "mux_webhooks",
        event: "mux_webhook_processing_failure",
        severity: "warning",
        title: "Mux webhook event keeps failing to process",
        dedupKey: `mux_webhook_failure:${event.id}`,
        cooldownSeconds: 6 * 60 * 60,
        details: {
          event_id: event.id,
          event_type: event.type,
          endpoint,
          attempts,
          error: errorSummary(err),
        },
      });
    }
    throw err;
  }
}

/** Events that are acknowledged but have no side effects (logged only). */
export type MuxLogOnlyEvents = Record<string, (event: MuxWebhookEvent) => void>;

export interface MuxWebhookEndpoint {
  /** Label stored with each event and used in logs. */
  endpoint: string;
  handlers: Record<string, MuxEventHandler>;
  logOnly?: MuxLogOnlyEvents;
  /** Error message when `data.id` is missing (endpoint-specific wording). */
  missingObjectIdError: string;
}

/**
 * Full request handling for a Mux webhook endpoint. Rate limiting, if any,
 * is the caller's job and happens before this.
 */
export async function handleMuxWebhook(
  req: Request,
  config: MuxWebhookEndpoint
): Promise<NextResponse> {
  const rawBody = await req.text();
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  const signatureHeader = req.headers.get("mux-signature");

  if (webhookSecret) {
    if (!signatureHeader) {
      console.error("❌ Missing Mux-Signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    if (!verifyMuxWebhookSignature(signatureHeader, rawBody, webhookSecret)) {
      console.error("❌ Invalid Mux webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "⚠️  MUX_WEBHOOK_SECRET not set — skipping signature verification (set it in production)"
    );
  }

  let event: MuxWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  console.log(`🔔 Mux webhook received (${config.endpoint}):`, event?.type);

  if (!event?.data?.id) {
    console.error("❌ No object ID in webhook event");
    return NextResponse.json(
      { error: config.missingObjectIdError },
      { status: 400 }
    );
  }

  const handler = config.handlers[event.type];
  if (!handler) {
    const logOnly = config.logOnly?.[event.type];
    if (logOnly) {
      logOnly(event);
    } else {
      console.log(`ℹ️ Unhandled Mux event type: ${event.type}`);
    }
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (typeof event.id !== "string" || event.id.length === 0) {
    console.error("❌ Mux webhook event has no event id");
    return NextResponse.json(
      { error: "Invalid event: missing event id" },
      { status: 400 }
    );
  }

  try {
    const outcome = await processMuxEventOnce(event, config.endpoint, handler);
    return NextResponse.json(
      { received: true, ...(outcome === "duplicate" && { duplicate: true }) },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
