import { defaultExecutor, type SqlExecutor } from "@/lib/db/executor";
import { sendOperationalAlert } from "@/lib/security/alerts";
import { logger } from "@/lib/tracing/logger";
import type { BackgroundJob, DispatchResult } from "./definition";
import { dispatchJob } from "./qstash";
import {
  runScheduledJob,
  type JobDelivery,
  type JobResult,
} from "./scheduled-job";

/**
 * Runs one delivery of a background job and decides what happens next
 * (#1416):
 *
 *   succeeded / partial ─▶ 200 (done; a dead letter for this message, if a
 *                                replay just fixed it, is marked resolved)
 *   skipped (lease held) ─▶ 200 (another run is doing the work)
 *   duplicate delivery   ─▶ 200 without running (message already succeeded)
 *   failed, attempts left ─▶ 500 → QStash retries with backoff
 *   failed, last attempt  ─▶ dead letter + alert, 500 (QStash moves it to its DLQ)
 *   failed, permanent     ─▶ dead letter + alert, 200 (retrying cannot help)
 *
 * The attempt number is the larger of QStash's retry count and the failed
 * runs already recorded for the message, so it survives a missing header.
 * Operator runs (CRON_SECRET) have no message and are never dead-lettered:
 * the caller sees the failure directly.
 */

export interface IncomingDelivery {
  trigger: "qstash" | "manual";
  messageId: string | null;
  /** QStash's Upstash-Retried header: retries so far (0 on first delivery). */
  retried: number;
}

export type ExecutionStatus =
  | "succeeded"
  | "partial"
  | "skipped"
  | "duplicate"
  | "retry"
  | "dead_lettered"
  | "failed";

export interface Execution {
  httpStatus: number;
  status: ExecutionStatus;
  attempt: number;
  maxAttempts: number;
  result?: JobResult;
  error?: string;
}

export interface ExecuteDeps {
  executor?: SqlExecutor;
  dispatch?: typeof dispatchJob;
}

const MAX_STORED_ERROR = 1_000;

async function priorFailedAttempts(
  executor: SqlExecutor,
  jobName: string,
  messageId: string
): Promise<{ failed: number; succeeded: boolean }> {
  const { rows } = await executor(
    `SELECT COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
            COUNT(*) FILTER (WHERE status IN ('succeeded', 'partial'))::int AS succeeded
       FROM job_runs
      WHERE job_name = $1 AND message_id = $2`,
    [jobName, messageId]
  );
  return {
    failed: Number(rows[0]?.failed ?? 0),
    succeeded: Number(rows[0]?.succeeded ?? 0) > 0,
  };
}

async function deadLetter(
  executor: SqlExecutor,
  job: BackgroundJob<unknown, unknown>,
  messageId: string,
  payload: unknown,
  attempts: number,
  reason: "retries_exhausted" | "permanent",
  error: string
): Promise<void> {
  const message = error.slice(0, MAX_STORED_ERROR);
  try {
    await executor(
      `INSERT INTO job_dead_letters
         (job_name, message_id, payload, attempts, reason, error)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       ON CONFLICT (job_name, message_id) DO UPDATE
         SET attempts = EXCLUDED.attempts,
             reason = EXCLUDED.reason,
             error = EXCLUDED.error,
             dead_lettered_at = NOW(),
             resolved_at = NULL`,
      [
        job.name,
        messageId,
        JSON.stringify(payload ?? {}),
        attempts,
        reason,
        message,
      ]
    );
  } catch (dbError) {
    // The QStash DLQ still holds the message; the alert below still fires.
    logger.error("job_dead_letter_record_failed", {
      job: job.name,
      messageId,
      errorMessage:
        dbError instanceof Error ? dbError.message : String(dbError),
    });
  }
  logger.error("job_dead_lettered", {
    job: job.name,
    messageId,
    attempts,
    reason,
    errorMessage: message,
  });
  await sendOperationalAlert({
    category: "background_jobs",
    event: "job_dead_lettered",
    severity: "critical",
    title: `Background job ${job.name} was dead-lettered`,
    dedupKey: `job_dead_letter:${job.name}`,
    cooldownSeconds: 15 * 60,
    details: {
      job: job.name,
      message_id: messageId,
      attempts,
      reason,
      error: message.slice(0, 300),
    },
  });
}

async function resolveDeadLetter(
  executor: SqlExecutor,
  jobName: string,
  messageId: string
): Promise<void> {
  await executor(
    `UPDATE job_dead_letters SET resolved_at = NOW()
      WHERE job_name = $1 AND message_id = $2 AND resolved_at IS NULL`,
    [jobName, messageId]
  ).catch(() => undefined);
}

export async function executeJob<P, D>(
  job: BackgroundJob<P, D>,
  rawPayload: unknown,
  incoming: IncomingDelivery,
  deps: ExecuteDeps = {}
): Promise<Execution> {
  const executor = deps.executor ?? defaultExecutor;
  const dispatch = deps.dispatch ?? dispatchJob;
  const anyJob = job as unknown as BackgroundJob<unknown, unknown>;
  const maxAttempts = incoming.trigger === "qstash" ? job.maxAttempts : 1;

  let attempt = incoming.retried + 1;
  if (incoming.messageId) {
    const prior = await priorFailedAttempts(
      executor,
      job.name,
      incoming.messageId
    );
    if (prior.succeeded) {
      logger.info("job_duplicate_delivery", {
        job: job.name,
        messageId: incoming.messageId,
      });
      return { httpStatus: 200, status: "duplicate", attempt, maxAttempts };
    }
    attempt = Math.max(attempt, prior.failed + 1);
  }

  let payload: P;
  try {
    payload = job.parsePayload(rawPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (incoming.messageId) {
      await deadLetter(
        executor,
        anyJob,
        incoming.messageId,
        rawPayload,
        attempt,
        "permanent",
        `invalid payload: ${message}`
      );
      return {
        httpStatus: 200,
        status: "dead_lettered",
        attempt,
        maxAttempts,
        error: message,
      };
    }
    return {
      httpStatus: 400,
      status: "failed",
      attempt,
      maxAttempts,
      error: message,
    };
  }

  const delivery: JobDelivery = {
    messageId: incoming.messageId,
    attempt,
    trigger: incoming.trigger,
  };

  const result = await runScheduledJob<D>({
    name: job.name,
    leaseKey: job.leaseKey?.(payload),
    leaseSeconds: job.leaseSeconds,
    timeoutMs: job.timeoutSeconds * 1000,
    expectedIntervalSeconds: job.expectedIntervalSeconds,
    delivery,
    executor,
    run: ({ runId }) =>
      job.run({
        payload,
        delivery,
        runId,
        dispatch: (next, options): Promise<DispatchResult> =>
          dispatch(anyJob, next, options),
      }),
  });

  if (job.afterRun) {
    await job.afterRun().catch(error =>
      logger.error("job_after_run_failed", {
        job: job.name,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    );
  }

  const base = { attempt, maxAttempts, result };
  switch (result.status) {
    case "succeeded":
    case "partial":
      if (incoming.messageId) {
        await resolveDeadLetter(executor, job.name, incoming.messageId);
      }
      return { ...base, httpStatus: 200, status: result.status };
    case "skipped":
      return { ...base, httpStatus: 200, status: "skipped" };
    case "failed":
      break;
  }

  const error = result.error ?? "job failed";
  if (!incoming.messageId) {
    return { ...base, httpStatus: 500, status: "failed", error };
  }
  if (result.permanent) {
    await deadLetter(
      executor,
      anyJob,
      incoming.messageId,
      payload,
      attempt,
      "permanent",
      error
    );
    return { ...base, httpStatus: 200, status: "dead_lettered", error };
  }
  if (attempt >= maxAttempts) {
    await deadLetter(
      executor,
      anyJob,
      incoming.messageId,
      payload,
      attempt,
      "retries_exhausted",
      error
    );
    return { ...base, httpStatus: 500, status: "dead_lettered", error };
  }
  logger.warn("job_attempt_failed", {
    job: job.name,
    messageId: incoming.messageId,
    attempt,
    maxAttempts,
    errorMessage: error,
  });
  return { ...base, httpStatus: 500, status: "retry", error };
}
