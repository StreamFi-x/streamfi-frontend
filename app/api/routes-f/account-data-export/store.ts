import { type ExportJob } from "./types";

const jobs = new Map<string, ExportJob>();
let counter = 0;

/** Synthetic processing delay before an export becomes ready (ms). */
export let completionDelayMs = 50;

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setCompletionDelayMs(ms: number): void {
  completionDelayMs = ms;
}

function buildDownloadUrl(exportId: string): string {
  // A signed, expiring URL in production; a static path is enough for this
  // in-memory demo route.
  return `/api/routes-f/account-data-export/download/${exportId}.zip?sig=demo`;
}

function scheduleCompletion(exportId: string, now: number): void {
  const existing = pendingTimers.get(exportId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    const job = jobs.get(exportId);
    if (!job || job.status !== "queued") {
      pendingTimers.delete(exportId);
      return;
    }
    const readyAt = new Date(now + completionDelayMs);
    jobs.set(exportId, {
      ...job,
      status: "ready",
      ready_at: readyAt.toISOString(),
      download_url: buildDownloadUrl(exportId),
      // The signed download URL is emailed to the account as soon as the
      // export finishes processing.
      emailed_at: readyAt.toISOString(),
    });
    pendingTimers.delete(exportId);
  }, completionDelayMs);

  pendingTimers.set(exportId, timer);
}

export function enqueueExport(
  accountId: string,
  now: number = Date.now()
): ExportJob {
  const exportId = `acct_exp_${++counter}`;
  const job: ExportJob = {
    export_id: exportId,
    account_id: accountId,
    status: "queued",
    created_at: new Date(now).toISOString(),
  };
  jobs.set(exportId, job);
  scheduleCompletion(exportId, now);
  return job;
}

export function getExport(exportId: string): ExportJob | undefined {
  return jobs.get(exportId);
}

export function markFailed(exportId: string, error: string): boolean {
  const job = jobs.get(exportId);
  if (!job) {return false;}
  jobs.set(exportId, { ...job, status: "failed", error });
  const timer = pendingTimers.get(exportId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(exportId);
  }
  return true;
}

export function resetStore(): void {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
  jobs.clear();
  counter = 0;
  completionDelayMs = 50;
}
