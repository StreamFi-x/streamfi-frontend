/**
 * Creates or updates the QStash schedule of every scheduled job in
 * lib/jobs/registry.ts, and deletes schedules this script created for jobs
 * that no longer exist. Idempotent; run after deploying a change to a job's
 * schedule. See docs/background-jobs.md.
 *
 *   npm run jobs:sync-schedules -- [--dry-run]
 *
 * Env: QSTASH_TOKEN, and JOBS_BASE_URL or NEXT_PUBLIC_APP_URL (the public
 * origin QStash calls).
 */
import dotenv from "dotenv";
import { getQStashClient, jobUrl, jobsBaseUrl } from "../lib/jobs/qstash";
import { JOBS } from "../lib/jobs/registry";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SCHEDULE_PREFIX = "streamfi-job-";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const client = getQStashClient();
  if (!client || !jobsBaseUrl()) {
    throw new Error(
      "QSTASH_TOKEN and JOBS_BASE_URL (or NEXT_PUBLIC_APP_URL) must be set"
    );
  }

  const wanted = new Set<string>();
  for (const job of JOBS) {
    if (!job.schedule) {
      continue;
    }
    const scheduleId = `${SCHEDULE_PREFIX}${job.name}`;
    wanted.add(scheduleId);
    const destination = jobUrl(job.name)!;
    console.log(
      `${dryRun ? "[dry-run] " : ""}upsert ${scheduleId}: ${job.schedule} -> ${destination} ` +
        `(retries ${job.maxAttempts - 1}, timeout ${job.leaseSeconds}s)`
    );
    if (!dryRun) {
      await client.schedules.create({
        scheduleId,
        destination,
        cron: job.schedule,
        retries: job.maxAttempts - 1,
        timeout: job.leaseSeconds,
        body: "{}",
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  for (const schedule of await client.schedules.list()) {
    if (
      schedule.scheduleId.startsWith(SCHEDULE_PREFIX) &&
      !wanted.has(schedule.scheduleId)
    ) {
      console.log(`${dryRun ? "[dry-run] " : ""}delete ${schedule.scheduleId}`);
      if (!dryRun) {
        await client.schedules.delete(schedule.scheduleId);
      }
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
