/**
 * Background job processor — called by Vercel Cron every minute via
 * POST /api/routes-f/jobs/process (see app/api/routes-f/jobs/process/route.ts).
 *
 * Processing loop:
 *   1. Select the oldest pending job.
 *   2. Mark it as 'running'.
 *   3. Execute the appropriate handler.
 *   4. On success: mark 'completed', store result.
 *   5. On failure: increment attempts; if attempts < max_attempts, mark back
 *      to 'pending' with exponential backoff delay; otherwise mark 'failed'.
 *
 * Auto-cleanup: completed/failed/cancelled jobs older than 30 days are deleted.
 */

import { sql } from "@vercel/postgres";
import { ensureJobsSchema, type JobType, type Job } from "./db";

// ── Job handlers ──────────────────────────────────────────────────────────────

type JobResult = Record<string, unknown>;

async function handleExport(
  job: Job
): Promise<JobResult> {
  // Placeholder: generate CSV/JSON and upload to R2, return download URL.
  // Real implementation would use an R2 client and stream data from the DB.
  const format = (job.payload?.format as string) ?? "json";
  return {
    message: "Export completed",
    format,
    download_url: null, // populated by real implementation
  };
}

async function handleClipProcess(
  job: Job
): Promise<JobResult> {
  // Placeholder: poll Mux asset status and update stream_recordings.
  const assetId = job.payload?.asset_id as string | undefined;
  if (!assetId) {throw new Error("clip_process job missing payload.asset_id");}
  return { asset_id: assetId, status: "ready" };
}

async function handleBatchNotify(
  job: Job
): Promise<JobResult> {
  // Placeholder: send bulk notifications to followers.
  const eventType = job.payload?.event_type as string | undefined;
  return { event_type: eventType, sent: 0 };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handleLeaderboardRefresh(_job: Job): Promise<JobResult> {
  // Placeholder: recompute leaderboard cache.
  return { recomputed_at: new Date().toISOString() };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handleSitemapRefresh(_job: Job): Promise<JobResult> {
  // Placeholder: regenerate sitemap and upload to CDN.
  return { refreshed_at: new Date().toISOString() };
}

const HANDLERS: Record<JobType, (job: Job) => Promise<JobResult>> = {
  export: handleExport,
  clip_process: handleClipProcess,
  batch_notify: handleBatchNotify,
  leaderboard_refresh: handleLeaderboardRefresh,
  sitemap_refresh: handleSitemapRefresh,
};

// ── Exponential backoff ───────────────────────────────────────────────────────

/** Returns the number of seconds to wait before retrying based on attempt count. */
function backoffSeconds(attempts: number): number {
  // 30s, 2m, 8m, 32m, …
  return Math.min(30 * Math.pow(4, attempts - 1), 3600);
}

// ── Core processor ────────────────────────────────────────────────────────────

/**
 * Process one pending job.
 * Returns the processed job id, or null if no pending job was found.
 */
export async function processNextJob(): Promise<string | null> {
  await ensureJobsSchema();

  // Select and claim the oldest pending job atomically
  const { rows: claimed } = await sql`
    UPDATE jobs
    SET status = 'running', started_at = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;

  if (claimed.length === 0) {return null;}

  const job = claimed[0] as Job;
  const handler = HANDLERS[job.type];

  if (!handler) {
    await sql`
      UPDATE jobs
      SET status = 'failed', error = ${"Unknown job type: " + job.type}, completed_at = now()
      WHERE id = ${job.id}
    `;
    return job.id;
  }

  try {
    const result = await handler(job);
    await sql`
      UPDATE jobs
      SET status = 'completed', result = ${JSON.stringify(result)}, completed_at = now()
      WHERE id = ${job.id}
    `;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`[jobs/process] Job ${job.id} (${job.type}) failed:`, err);

    if (job.attempts < job.max_attempts) {
      const delaySec = backoffSeconds(job.attempts);
      await sql`
        UPDATE jobs
        SET status = 'pending',
            error  = ${errorMessage},
            -- Schedule retry by shifting created_at into the future so it sorts
            -- after currently-pending jobs.
            created_at = now() + (${delaySec} || ' seconds')::INTERVAL
        WHERE id = ${job.id}
      `;
    } else {
      await sql`
        UPDATE jobs
        SET status = 'failed', error = ${errorMessage}, completed_at = now()
        WHERE id = ${job.id}
      `;
    }
  }

  return job.id;
}

/** Delete completed/failed/cancelled jobs older than 30 days. */
export async function cleanupOldJobs(): Promise<number> {
  const { rowCount } = await sql`
    DELETE FROM jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND created_at < now() - INTERVAL '30 days'
  `;
  return rowCount ?? 0;
}
