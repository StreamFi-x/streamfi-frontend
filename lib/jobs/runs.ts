import { sql } from "@vercel/postgres";

export type JobRunStatus = "completed" | "partial" | "failed";

/**
 * Record the start of a run. Scheduled jobs call this while holding the job's
 * lease, so any run of the same job still marked `running` belongs to a worker
 * that died (timeout, crash) and is closed as `abandoned`. Unleased callers
 * (admin-triggered audits) pass abandonStale = false.
 */
export async function startJobRun(
  jobName: string,
  { abandonStale = true }: { abandonStale?: boolean } = {}
): Promise<string> {
  if (abandonStale) {
    await sql`
      UPDATE job_runs
      SET status = 'abandoned', finished_at = now()
      WHERE job_name = ${jobName} AND status = 'running'
    `;
  }
  const { rows } = await sql`
    INSERT INTO job_runs (job_name) VALUES (${jobName}) RETURNING id
  `;
  return rows[0].id as string;
}

export async function finishJobRun(
  runId: string,
  status: JobRunStatus,
  metrics: Record<string, unknown>,
  error?: string
): Promise<void> {
  await sql`
    UPDATE job_runs
    SET status = ${status},
        finished_at = now(),
        metrics = ${JSON.stringify(metrics)}::jsonb,
        error = ${error ? truncateError(error) : null}
    WHERE id = ${runId}
  `;
}

/** Keep stored/logged error text short; provider errors can echo large payloads. */
export function truncateError(message: string, max = 500): string {
  return message.length > max ? `${message.slice(0, max)}…` : message;
}

export function errorMessage(err: unknown): string {
  return truncateError(err instanceof Error ? err.message : String(err));
}
