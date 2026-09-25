import { randomUUID } from "crypto";
import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";
import {
  sendOperationalAlert,
  type AlertCategory,
} from "@/lib/security/alerts";

/**
 * Lease + health bookkeeping for cron-triggered jobs (scheduled_job_runs).
 *
 * - Lease: a run only starts if no other run holds an unexpired lease, so
 *   overlapping cron invocations (slow run, manual trigger, retries) never
 *   execute concurrently. A crashed run's lease simply expires.
 * - Health: every run records start/finish/success/failure, the error and
 *   consecutive failure/drift counters. Failures raise an operational alert
 *   so the job never fails silently.
 */

export interface JobOutcome {
  summary: Record<string, unknown>;
  /** The run found (and corrected) drift — feeds consecutive_drift_runs. */
  drift?: boolean;
}

export type JobRunResult =
  | {
      status: "completed";
      summary: Record<string, unknown>;
      consecutiveDriftRuns: number;
    }
  | { status: "skipped"; reason: "lease_held" }
  | { status: "failed"; error: string; consecutiveFailures: number | null };

export interface ScheduledJobOptions {
  name: string;
  alertCategory: AlertCategory;
  /** Hard time budget for one run. */
  timeoutSeconds: number;
  /**
   * Lease length. Must exceed timeoutSeconds: a timed-out run's promise may
   * still be executing, so its lease is left to expire rather than released.
   */
  leaseSeconds: number;
}

class JobTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new JobTimeoutError(`job exceeded ${ms / 1000}s budget`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function acquireLease(
  name: string,
  owner: string,
  leaseSeconds: number
): Promise<boolean> {
  const { rows } = await sql`
    INSERT INTO scheduled_job_runs
      (job_name, lease_owner, lease_expires_at, last_started_at)
    VALUES (${name}, ${owner}, NOW() + make_interval(secs => ${leaseSeconds}), NOW())
    ON CONFLICT (job_name) DO UPDATE SET
      lease_owner      = EXCLUDED.lease_owner,
      lease_expires_at = EXCLUDED.lease_expires_at,
      last_started_at  = NOW()
    WHERE scheduled_job_runs.lease_expires_at IS NULL
       OR scheduled_job_runs.lease_expires_at < NOW()
    RETURNING job_name
  `;
  return rows.length > 0;
}

async function recordSuccess(
  name: string,
  owner: string,
  outcome: JobOutcome
): Promise<number> {
  const { rows } = await sql<{ consecutive_drift_runs: number }>`
    UPDATE scheduled_job_runs SET
      lease_owner            = NULL,
      lease_expires_at       = NULL,
      last_finished_at       = NOW(),
      last_succeeded_at      = NOW(),
      last_error             = NULL,
      consecutive_failures   = 0,
      consecutive_drift_runs = CASE WHEN ${outcome.drift === true}
                                    THEN consecutive_drift_runs + 1
                                    ELSE 0 END,
      last_summary           = ${JSON.stringify(outcome.summary)}::jsonb
    WHERE job_name = ${name} AND lease_owner = ${owner}
    RETURNING consecutive_drift_runs
  `;
  return rows[0]?.consecutive_drift_runs ?? 0;
}

async function recordFailure(
  name: string,
  owner: string,
  message: string,
  releaseLease: boolean
): Promise<number | null> {
  try {
    const { rows } = await sql<{ consecutive_failures: number }>`
      UPDATE scheduled_job_runs SET
        lease_owner          = CASE WHEN ${releaseLease} THEN NULL ELSE lease_owner END,
        lease_expires_at     = CASE WHEN ${releaseLease} THEN NULL ELSE lease_expires_at END,
        last_finished_at     = NOW(),
        last_failed_at       = NOW(),
        last_error           = ${message},
        consecutive_failures = consecutive_failures + 1
      WHERE job_name = ${name}
        AND (lease_owner = ${owner} OR lease_owner IS NULL
             OR lease_expires_at < NOW())
      RETURNING consecutive_failures
    `;
    return rows[0]?.consecutive_failures ?? null;
  } catch {
    return null;
  }
}

export async function runScheduledJob(
  options: ScheduledJobOptions,
  job: () => Promise<JobOutcome>
): Promise<JobRunResult> {
  const owner = randomUUID();
  const startedAt = Date.now();
  let leased = false;

  try {
    leased = await acquireLease(options.name, owner, options.leaseSeconds);
    if (!leased) {
      logger.info("scheduled_job_skipped", {
        job: options.name,
        reason: "lease_held",
      });
      return { status: "skipped", reason: "lease_held" };
    }

    const outcome = await withTimeout(job(), options.timeoutSeconds * 1000);
    const consecutiveDriftRuns = await recordSuccess(
      options.name,
      owner,
      outcome
    );
    logger.info("scheduled_job_completed", {
      job: options.name,
      duration_ms: Date.now() - startedAt,
      ...outcome.summary,
    });
    return {
      status: "completed",
      summary: outcome.summary,
      consecutiveDriftRuns,
    };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(
      0,
      500
    );
    const consecutiveFailures = await recordFailure(
      options.name,
      owner,
      message,
      !(err instanceof JobTimeoutError)
    );
    logger.error(`${options.name}_failure`, {
      job: options.name,
      phase: leased ? "run" : "lease",
      duration_ms: Date.now() - startedAt,
      consecutive_failures: consecutiveFailures,
      timeout: err instanceof JobTimeoutError,
      errorMessage: message,
    });
    await sendOperationalAlert({
      category: options.alertCategory,
      event: `${options.name}_failure`,
      severity:
        consecutiveFailures !== null && consecutiveFailures >= 3
          ? "critical"
          : "warning",
      title: `Scheduled job ${options.name} failed`,
      dedupKey: `job_failure:${options.name}`,
      cooldownSeconds: 30 * 60,
      details: {
        job: options.name,
        consecutive_failures: consecutiveFailures,
        timeout: err instanceof JobTimeoutError,
        error: message,
      },
    });
    return { status: "failed", error: message, consecutiveFailures };
  }
}

/**
 * Alerts when a job has not succeeded recently — catches a cron that stopped
 * firing altogether, which the job itself can never report.
 */
export async function assertJobFresh(
  name: string,
  maxAgeSeconds: number,
  alertCategory: AlertCategory
): Promise<boolean> {
  const { rows } = await sql<{ stale: boolean; last_succeeded_at: string }>`
    SELECT
      (last_succeeded_at IS NULL
        OR last_succeeded_at < NOW() - make_interval(secs => ${maxAgeSeconds})) AS stale,
      last_succeeded_at
    FROM scheduled_job_runs
    WHERE job_name = ${name}
  `;
  const stale = rows.length === 0 || rows[0].stale;
  if (stale) {
    await sendOperationalAlert({
      category: alertCategory,
      event: `${name}_stalled`,
      severity: "critical",
      title: `Scheduled job ${name} has not succeeded recently`,
      dedupKey: `job_stalled:${name}`,
      cooldownSeconds: 6 * 60 * 60,
      details: {
        job: name,
        max_age_seconds: maxAgeSeconds,
        last_succeeded_at: rows[0]?.last_succeeded_at
          ? String(rows[0].last_succeeded_at)
          : null,
      },
    });
  }
  return !stale;
}
