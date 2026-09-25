import { randomUUID } from "crypto";
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";
import { logger } from "@/lib/tracing/logger";

export type JobStatus = "succeeded" | "partial" | "failed" | "skipped";

export type JobMetrics = Record<string, number>;

export interface JobOutcome<TDetail = unknown> {
  status: Exclude<JobStatus, "skipped">;
  metrics: JobMetrics;
  /** Aggregated alert conditions detected by the job (at most one alert each). */
  alerts?: string[];
  detail?: TDetail;
}

export interface JobResult<TDetail = unknown> {
  job: string;
  /** Correlation id stored in job_runs.run_id; records a run writes carry it. */
  runId: string;
  status: JobStatus;
  startedAt: string;
  durationMs: number;
  metrics: JobMetrics;
  alerts: string[];
  reason?: string;
  error?: string;
  detail?: TDetail;
}

export interface ScheduledJobOptions<TDetail> {
  name: string;
  /** Lease length; must exceed the job's worst-case runtime. */
  leaseSeconds: number;
  /** Expected schedule; a gap of 3x this since the last success raises an alert. */
  expectedIntervalSeconds: number;
  /** Consecutive failed runs (including this one) that raise an alert. */
  failureAlertThreshold?: number;
  run: (context: { runId: string }) => Promise<JobOutcome<TDetail>>;
  executor?: SqlExecutor;
  now?: () => Date;
}

/**
 * Emits one structured alert log line. Log drains can route on
 * `alert: true`; there is no separate paging integration in this codebase.
 */
export function emitJobAlert(
  job: string,
  message: string,
  data: Record<string, unknown> = {}
): void {
  logger.error(`[job-alert] ${job}: ${message}`, {
    alert: true,
    job,
    ...data,
  });
}

/**
 * Takes a lease on `name`. Exactly one caller wins while a lease is live: the
 * upsert only replaces an existing row whose lease has expired, and the
 * primary key makes concurrent inserts collide.
 */
export async function acquireJobLease(
  name: string,
  leaseSeconds: number,
  executor: SqlExecutor = defaultExecutor
): Promise<string | null> {
  const holder = randomUUID();
  const { rows } = await executor(
    `INSERT INTO job_locks (job_name, holder, acquired_at, locked_until)
     VALUES ($1, $2, NOW(), NOW() + make_interval(secs => $3::double precision))
     ON CONFLICT (job_name) DO UPDATE
       SET holder = EXCLUDED.holder,
           acquired_at = EXCLUDED.acquired_at,
           locked_until = EXCLUDED.locked_until
       WHERE job_locks.locked_until < NOW()
     RETURNING holder`,
    [name, holder, leaseSeconds]
  );
  return rows[0]?.holder === holder ? holder : null;
}

export async function releaseJobLease(
  name: string,
  holder: string,
  executor: SqlExecutor = defaultExecutor
): Promise<void> {
  await executor(`DELETE FROM job_locks WHERE job_name = $1 AND holder = $2`, [
    name,
    holder,
  ]);
}

async function recordRun(
  executor: SqlExecutor,
  result: JobResult
): Promise<void> {
  try {
    await executor(
      `INSERT INTO job_runs (job_name, status, started_at, duration_ms, metrics, error, run_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        result.job,
        result.status,
        result.startedAt,
        result.durationMs,
        JSON.stringify(result.metrics),
        result.error ?? result.reason ?? null,
        result.runId,
      ]
    );
  } catch (error) {
    logger.error("Failed to record job run", {
      job: result.job,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

async function detectRunGap(
  executor: SqlExecutor,
  name: string,
  expectedIntervalSeconds: number,
  now: Date
): Promise<string | null> {
  const { rows } = await executor(
    `SELECT MAX(started_at) AS last_success FROM job_runs
     WHERE job_name = $1 AND status IN ('succeeded', 'partial')`,
    [name]
  );
  const last = rows[0]?.last_success;
  if (!last) {
    return null;
  }
  const gapSeconds = (now.getTime() - new Date(last).getTime()) / 1000;
  if (gapSeconds > expectedIntervalSeconds * 3) {
    return `no successful run for ${Math.round(gapSeconds / 60)} minutes (expected every ${Math.round(expectedIntervalSeconds / 60)})`;
  }
  return null;
}

async function consecutiveFailures(
  executor: SqlExecutor,
  name: string,
  limit: number
): Promise<number> {
  const { rows } = await executor(
    `SELECT status FROM job_runs WHERE job_name = $1 AND status <> 'skipped'
     ORDER BY started_at DESC LIMIT $2`,
    [name, limit]
  );
  let count = 0;
  for (const row of rows) {
    if (row.status !== "failed") {
      break;
    }
    count++;
  }
  return count;
}

/**
 * Runs a scheduled job under a distributed lease and records the run.
 *
 * - Overlapping invocations return `skipped` instead of running twice.
 * - Every run (including skipped/failed) is written to job_runs.
 * - Alerts are aggregated per run: the job's own alert conditions, repeated
 *   failures, and a gap since the last successful run.
 */
export async function runScheduledJob<TDetail>(
  options: ScheduledJobOptions<TDetail>
): Promise<JobResult<TDetail>> {
  const executor = options.executor ?? defaultExecutor;
  const now = options.now ?? (() => new Date());
  const started = now();
  const startedAt = started.toISOString();
  const runId = randomUUID();
  const threshold = options.failureAlertThreshold ?? 3;

  const holder = await acquireJobLease(
    options.name,
    options.leaseSeconds,
    executor
  );
  if (!holder) {
    const skipped: JobResult<TDetail> = {
      job: options.name,
      runId,
      status: "skipped",
      startedAt,
      durationMs: 0,
      metrics: {},
      alerts: [],
      reason: "another run holds the job lease",
    };
    logger.info("Scheduled job skipped", {
      job: options.name,
      reason: skipped.reason,
    });
    await recordRun(executor, skipped);
    return skipped;
  }

  logger.info("Scheduled job started", { job: options.name });
  const alerts: string[] = [];
  let result: JobResult<TDetail>;

  try {
    const gap = await detectRunGap(
      executor,
      options.name,
      options.expectedIntervalSeconds,
      started
    ).catch(() => null);
    if (gap) {
      alerts.push(gap);
    }

    const outcome = await options.run({ runId });
    alerts.push(...(outcome.alerts ?? []));
    result = {
      job: options.name,
      runId,
      status: outcome.status,
      startedAt,
      durationMs: now().getTime() - started.getTime(),
      metrics: outcome.metrics,
      alerts,
      detail: outcome.detail,
    };
  } catch (error) {
    result = {
      job: options.name,
      runId,
      status: "failed",
      startedAt,
      durationMs: now().getTime() - started.getTime(),
      metrics: {},
      alerts,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await releaseJobLease(options.name, holder, executor).catch(error =>
      logger.error("Failed to release job lease", {
        job: options.name,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    );
  }

  await recordRun(executor, result);

  if (result.status === "failed") {
    const failures = await consecutiveFailures(
      executor,
      options.name,
      threshold
    ).catch(() => 0);
    if (failures >= threshold) {
      alerts.push(
        `${failures} consecutive failed runs (latest: ${result.error})`
      );
    }
  }

  const logData = {
    job: options.name,
    status: result.status,
    durationMs: result.durationMs,
    metrics: result.metrics,
    ...(result.error ? { errorMessage: result.error } : {}),
  };
  if (result.status === "failed") {
    logger.error("Scheduled job failed", logData);
  } else {
    logger.info("Scheduled job finished", logData);
  }

  for (const alert of alerts) {
    emitJobAlert(options.name, alert, { metrics: result.metrics });
  }

  return result;
}

/** HTTP status for a job result: 207 when some records failed, 500 on failure. */
export function jobHttpStatus(status: JobStatus): number {
  if (status === "failed") {
    return 500;
  }
  if (status === "partial") {
    return 207;
  }
  return 200;
}
