import { Client, Receiver } from "@upstash/qstash";
import { logger } from "@/lib/tracing/logger";
import type {
  BackgroundJob,
  DispatchOptions,
  DispatchResult,
} from "./definition";

/**
 * Upstash QStash: schedules, dispatches and retries background jobs (#1416).
 * QStash calls app/api/jobs/<name> with a signed request; a non-2xx response
 * is retried with exponential backoff up to the job's maxAttempts, after
 * which the message moves to the QStash DLQ (and lib/jobs/execute.ts records
 * a dead letter in job_dead_letters).
 *
 * Env: QSTASH_TOKEN (publish, schedules), QSTASH_CURRENT_SIGNING_KEY and
 * QSTASH_NEXT_SIGNING_KEY (verify; both, so keys can be rotated),
 * JOBS_BASE_URL or NEXT_PUBLIC_APP_URL (the public origin QStash calls).
 */

export function jobsBaseUrl(): string | null {
  const base = process.env.JOBS_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  return base ? base.replace(/\/+$/, "") : null;
}

export function jobUrl(name: string): string | null {
  const base = jobsBaseUrl();
  return base ? `${base}/api/jobs/${name}` : null;
}

let receiver: Receiver | null | undefined;

function getReceiver(): Receiver | null {
  if (receiver === undefined) {
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    receiver =
      currentSigningKey && nextSigningKey
        ? new Receiver({ currentSigningKey, nextSigningKey })
        : null;
  }
  return receiver;
}

/**
 * True only for a request QStash signed for exactly this job's URL and body.
 * Fails closed when the signing keys or the base URL are not configured.
 */
export async function verifyQStashSignature(
  jobName: string,
  signature: string,
  body: string
): Promise<boolean> {
  const verifier = getReceiver();
  const url = jobUrl(jobName);
  if (!verifier || !url) {
    return false;
  }
  try {
    return await verifier.verify({ signature, body, url, clockTolerance: 5 });
  } catch {
    return false;
  }
}

let client: Client | null | undefined;

export function getQStashClient(): Client | null {
  if (client === undefined) {
    const token = process.env.QSTASH_TOKEN;
    client = token ? new Client({ token }) : null;
  }
  return client;
}

/**
 * Queues one run of `job`. Returns `not_configured` rather than throwing when
 * QStash is not set up, so callers can degrade (for example, leave the work to
 * the next scheduled run).
 */
export async function dispatchJob<P>(
  job: BackgroundJob<P, unknown>,
  payload: P,
  options: DispatchOptions = {}
): Promise<DispatchResult> {
  const qstash = getQStashClient();
  const url = jobUrl(job.name);
  if (!qstash || !url) {
    return { dispatched: false, reason: "not_configured" };
  }
  try {
    const response = await qstash.publishJSON({
      url,
      body: payload,
      retries: job.maxAttempts - 1,
      timeout: job.leaseSeconds,
      deduplicationId: options.deduplicationId,
      delay: options.delaySeconds,
    });
    return { dispatched: true, messageId: response.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("job_dispatch_failed", {
      job: job.name,
      errorMessage: message,
    });
    return { dispatched: false, reason: "error", error: message };
  }
}

export function resetQStashForTests(): void {
  receiver = undefined;
  client = undefined;
}
