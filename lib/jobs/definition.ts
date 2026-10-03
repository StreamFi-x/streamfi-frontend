import { PermanentJobError } from "./errors";
import type { JobDelivery, JobOutcome } from "./scheduled-job";

/**
 * A background job (#1416): what it does and how it is scheduled, retried and
 * leased. Register it in lib/jobs/registry.ts; the dispatch endpoint
 * (app/api/jobs/[job]) and the schedule sync script pick it up from there.
 * See docs/background-jobs.md.
 *
 * Contract for `run`:
 * - Idempotent. QStash delivers at least once, and a failed attempt is
 *   retried after partial progress, so running twice must be harmless.
 * - Bounded. Finish inside `timeoutSeconds`; split larger work into
 *   continuations with `ctx.dispatch`.
 * - Safe to overlap. The lease avoids duplicate work, but a run that timed
 *   out may still be finishing when its retry starts.
 * - Throw (or return status "failed") for a transient failure: the delivery
 *   is retried with backoff. Throw PermanentJobError for a failure retrying
 *   cannot fix: it is dead-lettered at once.
 */
export interface JobContext<P> {
  payload: P;
  delivery: JobDelivery;
  /** This run's job_runs.run_id, for records the run writes. */
  runId: string;
  /** Queues another run of this job (a continuation). */
  dispatch: (payload: P, options?: DispatchOptions) => Promise<DispatchResult>;
}

export interface DispatchOptions {
  /** Same id within QStash's dedup window: enqueued once. */
  deduplicationId?: string;
  delaySeconds?: number;
}

export type DispatchResult =
  | { dispatched: true; messageId: string }
  | { dispatched: false; reason: "not_configured" | "error"; error?: string };

export interface BackgroundJob<P = Record<string, never>, D = unknown> {
  /** URL segment and job_runs.job_name; lowercase words joined by '-'. */
  name: string;
  description: string;
  /** UTC cron expression for jobs QStash runs on a schedule. */
  schedule?: string;
  /** For scheduled jobs: no success for 3x this raises an alert. */
  expectedIntervalSeconds?: number;
  /** Deliveries including the first; QStash retries the rest with backoff. */
  maxAttempts: number;
  /**
   * Time limit for one run. Must stay under the dispatch route's maxDuration
   * (60s) so a slow run is failed and retried, not killed mid-way.
   */
  timeoutSeconds: number;
  /** Lease length, and QStash's delivery timeout; longer than timeoutSeconds. */
  leaseSeconds: number;
  /** Lease scope per payload (e.g. one run per creator); default: per job. */
  leaseKey?: (payload: P) => string;
  /**
   * Validates the delivered body. Anything a job can be asked to do must pass
   * through here, so a caller can never make a job do arbitrary work. Throw
   * PermanentJobError for an invalid payload.
   */
  parsePayload: (raw: unknown) => P;
  run: (ctx: JobContext<P>) => Promise<JobOutcome<D>>;
  /**
   * Runs after every delivery, including skipped and failed ones (e.g. to
   * evaluate alerts left pending by a crashed run). Its errors are logged and
   * never change the delivery's outcome.
   */
  afterRun?: () => Promise<void>;
}

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Retries are bounded; a job that needs more is not transiently failing.
// (QStash plans also cap retries per message; stay within yours.)
const MAX_ATTEMPTS_LIMIT = 5;
// app/api/jobs/[job] has maxDuration 60; leave time to record the outcome.
const MAX_TIMEOUT_SECONDS = 55;

export function defineJob<P, D>(job: BackgroundJob<P, D>): BackgroundJob<P, D> {
  if (!NAME.test(job.name)) {
    throw new Error(`job name "${job.name}" is invalid`);
  }
  if (
    !Number.isInteger(job.maxAttempts) ||
    job.maxAttempts < 1 ||
    job.maxAttempts > MAX_ATTEMPTS_LIMIT
  ) {
    throw new Error(
      `job "${job.name}": maxAttempts must be an integer from 1 to ${MAX_ATTEMPTS_LIMIT}`
    );
  }
  if (
    !Number.isInteger(job.timeoutSeconds) ||
    job.timeoutSeconds < 1 ||
    job.timeoutSeconds > MAX_TIMEOUT_SECONDS
  ) {
    throw new Error(
      `job "${job.name}": timeoutSeconds must be an integer from 1 to ${MAX_TIMEOUT_SECONDS}`
    );
  }
  if (
    !Number.isInteger(job.leaseSeconds) ||
    job.leaseSeconds <= job.timeoutSeconds
  ) {
    throw new Error(
      `job "${job.name}": leaseSeconds must be an integer above timeoutSeconds`
    );
  }
  return job;
}

/** For jobs without a payload: accepts an empty body or `{}` only. */
export function noPayload(raw: unknown): Record<string, never> {
  if (
    raw === undefined ||
    raw === null ||
    (typeof raw === "object" && Object.keys(raw as object).length === 0)
  ) {
    return {};
  }
  throw new PermanentJobError("this job takes no payload");
}
