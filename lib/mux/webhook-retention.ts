import { sql } from "@vercel/postgres";

/**
 * Retention for mux_webhook_events (#1397).
 *
 * The idempotency record must outlive every plausible redelivery of the
 * event. Mux signs each delivery attempt with a fresh timestamp and retries
 * failed deliveries with backoff for up to about a day; manual resends from
 * the Mux dashboard can come later still. The 300s signature window is
 * therefore irrelevant here. Default: 7 days for processed events (never
 * below 2), 30 days for failed ones so they stay available for
 * investigation.
 */

export const MIN_RETENTION_DAYS = 2;
export const DEFAULT_RETENTION_DAYS = 7;
export const FAILED_EVENT_RETENTION_DAYS = 30;

export function webhookEventRetentionDays(): number {
  const parsed = Number(process.env.MUX_WEBHOOK_EVENT_RETENTION_DAYS);
  if (!Number.isInteger(parsed)) {
    return DEFAULT_RETENTION_DAYS;
  }
  return Math.min(Math.max(parsed, MIN_RETENTION_DAYS), 365);
}

export interface PurgeResult {
  deleted: number;
  /** false when the batch cap was hit; the rest is purged on the next run. */
  complete: boolean;
  retention_days: number;
}

/**
 * Deletes expired idempotency records in bounded batches so the purge never
 * holds long locks. Safe alongside live webhook traffic: a row is only
 * removed once it is older than the retention window, and a concurrent
 * delivery of an unexpired event still conflicts on the primary key.
 */
export async function purgeExpiredMuxWebhookEvents(
  opts: { batchSize?: number; maxBatches?: number } = {}
): Promise<PurgeResult> {
  const batchSize = opts.batchSize ?? 5_000;
  const maxBatches = opts.maxBatches ?? 20;
  const retentionDays = webhookEventRetentionDays();
  const failedRetentionDays = Math.max(
    FAILED_EVENT_RETENTION_DAYS,
    retentionDays
  );

  let deleted = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const { rowCount } = await sql`
      DELETE FROM mux_webhook_events
      WHERE event_id IN (
        SELECT event_id FROM mux_webhook_events
        WHERE (status = 'processed'
               AND COALESCE(processed_at, received_at)
                   < NOW() - make_interval(days => ${retentionDays}))
           OR (status = 'failed'
               AND received_at < NOW() - make_interval(days => ${failedRetentionDays}))
        LIMIT ${batchSize}
      )
    `;
    const count = rowCount ?? 0;
    deleted += count;
    if (count < batchSize) {
      return { deleted, complete: true, retention_days: retentionDays };
    }
  }
  return { deleted, complete: false, retention_days: retentionDays };
}
