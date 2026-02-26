import { AuditEvent, MaintenanceWindow, RoutesFRecord, RoutesFJob } from "./types";
import { sanitizeObject } from "./sanitizer";

let routesFRecords: RoutesFRecord[] = [
  {
    id: "rf-001",
    title: "Routes-F Quickstart",
    description: "Getting started guide for Routes-F integrations.",
    tags: ["guide", "getting-started"],
    createdAt: "2026-02-20T10:00:00.000Z",
    updatedAt: "2026-02-20T10:00:00.000Z",
    status: "active",
    etag: `"2026-02-20T10:00:00.000Z"`,
  },
  {
    id: "rf-002",
    title: "Latency Benchmarks",
    description: "Latest latency numbers and benchmarks.",
    tags: ["metrics", "performance"],
    createdAt: "2026-02-21T12:30:00.000Z",
    updatedAt: "2026-02-21T12:30:00.000Z",
    status: "active",
    etag: `"2026-02-21T12:30:00.000Z"`,
  },
  {
    id: "rf-003",
    title: "Cache Strategy",
    description: "How Routes-F cache tiers are structured.",
    tags: ["cache", "architecture"],
    createdAt: "2026-02-22T08:15:00.000Z",
    updatedAt: "2026-02-22T08:15:00.000Z",
    status: "inactive",
    etag: `"2026-02-22T08:15:00.000Z"`,
  },
  {
    id: "rf-004",
    title: "Feature Flags Overview",
    description: "Flag rollout plan for Routes-F experiments.",
    tags: ["flags", "rollout"],
    createdAt: "2026-02-23T09:45:00.000Z",
    updatedAt: "2026-02-23T09:45:00.000Z",
    status: "active",
    etag: `"2026-02-23T09:45:00.000Z"`,
  },
  {
    id: "rf-005",
    title: "Operational Playbook",
    description: "Maintenance and incident response runbook.",
    tags: ["operations", "maintenance"],
    createdAt: "2026-02-24T01:05:00.000Z",
    updatedAt: "2026-02-24T01:05:00.000Z",
    status: "active",
    etag: `"2026-02-24T01:05:00.000Z"`,
  },
];

let maintenanceWindows: MaintenanceWindow[] = [];

let auditEvents: AuditEvent[] = [
  {
    id: "ae-005",
    actor: "system-bot",
    action: "HEALTH_CHECK_PASSED",
    target: "routes-f/health",
    timestamp: "2026-02-24T11:00:00.000Z",
  },
  {
    id: "ae-004",
    actor: "admin-alice",
    action: "FLAG_UPDATED",
    target: "routes-f/flags/new-ui",
    timestamp: "2026-02-24T10:30:00.000Z",
  },
  {
    id: "ae-003",
    actor: "admin-bob",
    action: "CACHE_PURGED",
    target: "routes-f/cache/global",
    timestamp: "2026-02-24T09:15:00.000Z",
  },
  {
    id: "ae-002",
    actor: "system-cron",
    action: "METRICS_ROTATED",
    target: "routes-f/metrics",
    timestamp: "2026-02-24T00:00:00.000Z",
  },
  {
    id: "ae-001",
    actor: "admin-alice",
    action: "MAINTENANCE_SCHEDULED",
    target: "routes-f/maintenance",
    timestamp: "2026-02-23T22:00:00.000Z",
  },
];

let routesFJobs: RoutesFJob[] = [
  { id: "job-queued", status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "job-running", status: "running", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "job-complete", status: "complete", result: { data: "success" }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "job-failed", status: "failed", error: "Something went wrong", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

/* ============================= */
/*            JOBS               */
/* ============================= */

export function getRoutesFJob(id: string): RoutesFJob | undefined {
  return routesFJobs.find(job => job.id === id);
}

export function __test__setRoutesFJobs(jobs: RoutesFJob[]) {
  routesFJobs = [...jobs];
}

/* ============================= */
/*        ROUTES-F RECORDS      */
/* ============================= */

export function getRoutesFRecords(): RoutesFRecord[] {
  return [...routesFRecords];
}

export function setRoutesFRecords(records: RoutesFRecord[]) {
  routesFRecords = sanitizeObject([...records]);
}

export function getRecentRoutesFRecords(limit: number): RoutesFRecord[] {
  return [...routesFRecords]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/* ===== LIST (Cursor + Status Filter) ===== */

export function listRoutesFRecords(params: {
  limit: number;
  cursor?: string;
  status: string;
}): { items: RoutesFRecord[]; total: number; nextCursor: string | null } {
  const filtered = routesFRecords.filter(
    (r) => (r.status || "active") === params.status
  );

  const sorted = [...filtered].sort((a, b) => {
    const dateCmp = b.createdAt.localeCompare(a.createdAt);
    if (dateCmp !== 0) return dateCmp;
    return b.id.localeCompare(a.id);
  });

  let startIndex = 0;

  if (params.cursor) {
    const cursorIndex = sorted.findIndex((r) => r.id === params.cursor);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }

  const slice = sorted.slice(startIndex, startIndex + params.limit);

  const nextCursor =
    slice.length === params.limit && startIndex + params.limit < sorted.length
      ? slice[slice.length - 1].id
      : null;

  return { items: slice, total: sorted.length, nextCursor };
}

/* ===== CRUD ===== */

export function createRoutesFRecord(input: {
  title: string;
  description: string;
  tags?: string[];
}): RoutesFRecord {
  if (!input.title?.trim() || !input.description?.trim()) {
    throw new Error("invalid-payload");
  }

  const now = new Date().toISOString();

  const newRecord: RoutesFRecord = {
    id: `rf-${Math.random().toString(36).slice(2, 10)}`,
    title: input.title.trim(),
    description: input.description.trim(),
    tags: input.tags || [],
    createdAt: now,
    updatedAt: now,
    status: "active",
    etag: `"${now}"`,
  };

  routesFRecords = [newRecord, ...routesFRecords];
  return newRecord;
}

export function getRoutesFRecordById(id: string): RoutesFRecord | undefined {
  return routesFRecords.find((r) => r.id === id);
}

export function updateRoutesFRecord(
  id: string,
  updates: Partial<RoutesFRecord>,
  ifMatchHeader?: string
): RoutesFRecord | null {
  const index = routesFRecords.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const current = routesFRecords[index];

  if (ifMatchHeader) {
    const etag = current.etag || `"${current.updatedAt}"`;
    if (ifMatchHeader !== etag) {
      throw new Error("ETAG_MISMATCH");
    }
  }

  const updatedAt = new Date().toISOString();

  const updated: RoutesFRecord = {
    ...current,
    ...updates,
    id: current.id,
    updatedAt,
    etag: `"${updatedAt}"`,
  };

  routesFRecords[index] = updated;
  return updated;
}

export function deleteRoutesFRecord(id: string): boolean {
  const index = routesFRecords.findIndex((r) => r.id === id);
  if (index === -1) return false;

  routesFRecords.splice(index, 1);
  return true;
}

/* ============================= */
/*            SEARCH             */
/* ============================= */

export function searchRoutesFRecords(params: {
  query?: string;
  tag?: string;
  limit: number;
}): { total: number; items: RoutesFRecord[] } {
  const query = params.query?.trim().toLowerCase();
  const tag = params.tag?.trim().toLowerCase();

  let filtered = [...routesFRecords];

  if (query) {
    filtered = filtered.filter(record => {
      const haystack = [
        record.title,
        record.description,
        record.tags.join(" "),
      ].join(" ").toLowerCase();

      return haystack.includes(query);
    });
  }

  if (tag) {
    filtered = filtered.filter(record =>
      record.tags.some(item => item.toLowerCase() === tag)
    );
  }

  const sorted = filtered.sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return {
    total: filtered.length,
    items: sorted.slice(0, params.limit),
  };
}

/* ============================= */
/*     MAINTENANCE WINDOWS      */
/* ============================= */

function windowsOverlap(a: MaintenanceWindow, b: MaintenanceWindow) {
  return Date.parse(a.start) < Date.parse(b.end) &&
         Date.parse(b.start) < Date.parse(a.end);
}

export function getMaintenanceWindows(now = new Date()): MaintenanceWindow[] {
  return maintenanceWindows.filter(window => {
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);
    const current = now.getTime();
    return start <= current && current <= end;
  });
}

export function createMaintenanceWindow(input: {
  start: string;
  end: string;
  reason?: string;
}): MaintenanceWindow {
  const sanitizedInput = sanitizeObject(input);
  const startMs = Date.parse(sanitizedInput.start);
  const endMs = Date.parse(sanitizedInput.end);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error("invalid-time");
  }

  if (startMs >= endMs) {
    throw new Error("invalid-range");
  }

  const candidate: MaintenanceWindow = {
    id: `mw-${Math.random().toString(36).slice(2, 10)}`,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    reason: sanitizedInput.reason?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const overlap = maintenanceWindows.some(window =>
    windowsOverlap(window, candidate)
  );

  if (overlap) {
    throw new Error("overlap");
  }

  maintenanceWindows = [...maintenanceWindows, candidate]
    .sort((a, b) => a.start.localeCompare(b.start));

  return candidate;
}

export function clearMaintenanceWindows() {
  maintenanceWindows = [];
}

/* ============================= */
/*           AUDIT TRAIL        */
/* ============================= */

export function getAuditTrail(params: {
  limit: number;
  cursor?: string;
}): { items: AuditEvent[]; nextCursor: string | null } {
  const sortedEvents = [...auditEvents]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  let startIndex = 0;

  if (params.cursor) {
    const index = sortedEvents.findIndex(e => e.id === params.cursor);
    if (index === -1) return { items: [], nextCursor: null };
    startIndex = index + 1;
  }

  const items = sortedEvents.slice(startIndex, startIndex + params.limit);

  const nextCursor =
    items.length > 0 && startIndex + items.length < sortedEvents.length
      ? items[items.length - 1].id
      : null;

  return { items, nextCursor };
}

/* ============================= */
/*        TEST HELPERS          */
/* ============================= */

export function __test__setAuditEvents(events: AuditEvent[]) {
  auditEvents = sanitizeObject([...events]);
}

export function __test__setMaintenanceWindows(windows: MaintenanceWindow[]) {
  maintenanceWindows = sanitizeObject([...windows]);
}

export function __test__setRoutesFRecords(records: RoutesFRecord[]) {
  routesFRecords = sanitizeObject([...records]);
}