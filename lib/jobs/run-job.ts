import { acquireLease, releaseLease, renewLease } from "@/lib/jobs/lease";
import { errorMessage, finishJobRun, startJobRun } from "@/lib/jobs/runs";
import { createDeadline } from "@/lib/jobs/retry";

export interface JobContext {
  runId: string;
  deadlineExpired: () => boolean;
  renewLease: () => Promise<boolean>;
}

export interface JobBodyResult<M> {
  status: "completed" | "partial";
  metrics: M;
}

export type JobOutcome<M> =
  | { outcome: "skipped_locked"; job: string }
  | {
      outcome: "completed" | "partial";
      job: string;
      runId: string;
      metrics: M;
    }
  | { outcome: "failed"; job: string; runId: string; error: string };

/**
 * Run one scheduled job invocation:
 *  - only one worker at a time (DB lease; a concurrent invocation is skipped);
 *  - a durable job_runs row with the final metrics;
 *  - a wall-clock budget below the function timeout so the job stops cleanly
 *    and reports "partial" instead of being killed mid-step;
 *  - a structured log line for the platform's log drain.
 */
export async function runScheduledJob<M extends object>(
  jobName: string,
  options: { leaseSeconds: number; budgetMs: number },
  body: (ctx: JobContext) => Promise<JobBodyResult<M>>
): Promise<JobOutcome<M>> {
  const lease = await acquireLease(jobName, options.leaseSeconds);
  if (!lease) {
    console.log(JSON.stringify({ job: jobName, outcome: "skipped_locked" }));
    return { outcome: "skipped_locked", job: jobName };
  }

  const startedAt = Date.now();
  let runId: string | null = null;
  try {
    runId = await startJobRun(jobName);
    const deadline = createDeadline(options.budgetMs);
    const result = await body({
      runId,
      deadlineExpired: deadline.expired,
      renewLease: () => renewLease(lease, options.leaseSeconds),
    });
    const metrics = { ...result.metrics, duration_ms: Date.now() - startedAt };
    await finishJobRun(runId, result.status, metrics);
    console.log(
      JSON.stringify({ job: jobName, runId, outcome: result.status, metrics })
    );
    return {
      outcome: result.status,
      job: jobName,
      runId,
      metrics: result.metrics,
    };
  } catch (err) {
    const error = errorMessage(err);
    console.error(
      JSON.stringify({ job: jobName, runId, outcome: "failed", error })
    );
    if (runId) {
      await finishJobRun(
        runId,
        "failed",
        { duration_ms: Date.now() - startedAt },
        error
      ).catch(finishErr =>
        console.error(
          `[${jobName}] could not record failed run ${runId}: ${errorMessage(finishErr)}`
        )
      );
    }
    return { outcome: "failed", job: jobName, runId: runId ?? "", error };
  } finally {
    await releaseLease(lease).catch(err =>
      console.error(
        `[${jobName}] could not release lease: ${errorMessage(err)}`
      )
    );
  }
}
