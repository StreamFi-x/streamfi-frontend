export type RoutesFJobType = "index_item" | "recompute_stats" | "notify_user";

export type RoutesFJob = {
  id: string;
  type: RoutesFJobType;
  payload: Record<string, unknown>;
  status: "queued";
  createdAt: string;
};

export const ROUTES_F_JOB_TYPES: readonly RoutesFJobType[] = [
  "index_item",
  "recompute_stats",
  "notify_user",
];

const inMemoryQueue: RoutesFJob[] = [];
let sequence = 1;

export function isValidRoutesFJobType(value: unknown): value is RoutesFJobType {
  return typeof value === "string" && ROUTES_F_JOB_TYPES.includes(value as RoutesFJobType);
}

export function enqueueRoutesFJob(
  type: RoutesFJobType,
  payload: Record<string, unknown>
): RoutesFJob {
  const job: RoutesFJob = {
    id: `job_${sequence++}`,
    type,
    payload,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  inMemoryQueue.push(job);
  return job;
}
