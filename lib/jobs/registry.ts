import type { BackgroundJob } from "./definition";
import {
  tipRefreshCreatorJob,
  tipTotalReconciliationJob,
} from "./definitions/tip-reconciliation";

/**
 * Every background job. Only jobs listed here can be triggered through
 * app/api/jobs/[job], and scripts/sync-job-schedules.ts creates the QStash
 * schedules for the ones with a `schedule`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jobs differ in payload type
export const JOBS: readonly BackgroundJob<any, unknown>[] = [
  tipTotalReconciliationJob,
  tipRefreshCreatorJob,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see JOBS
export function getJob(name: string): BackgroundJob<any, unknown> | null {
  return JOBS.find(job => job.name === name) ?? null;
}
