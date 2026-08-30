import { EXPORT_SECTIONS, type ExportJob, type ExportSection } from "./types";

const jobs = new Map<string, ExportJob>();
let counter = 0;

/** Synthetic processing delay before an export becomes ready (ms). */
export let completionDelayMs = 50;

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setCompletionDelayMs(ms: number): void {
  completionDelayMs = ms;
}

function buildDownloadUrl(exportId: string): string {
  return `/api/routes-f/creator-export/download/${exportId}.csv`;
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
    jobs.set(exportId, {
      ...job,
      status: "ready",
      ready_at: new Date(now + completionDelayMs).toISOString(),
      download_url: buildDownloadUrl(exportId),
    });
    pendingTimers.delete(exportId);
  }, completionDelayMs);

  pendingTimers.set(exportId, timer);
}

export function enqueueExport(
  creatorId: string,
  sections: ExportSection[],
  now: number = Date.now()
): ExportJob {
  const exportId = `exp_${++counter}`;
  const job: ExportJob = {
    export_id: exportId,
    creator_id: creatorId,
    sections,
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

export function isValidSection(value: unknown): value is ExportSection {
  return (
    typeof value === "string" &&
    EXPORT_SECTIONS.includes(value as ExportSection)
  );
}
