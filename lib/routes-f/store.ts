import { MaintenanceWindow, RoutesFRecord } from "./types";

let routesFRecords: RoutesFRecord[] = [
  {
    id: "rf-001",
    title: "Routes-F Quickstart",
    description: "Getting started guide for Routes-F integrations.",
    tags: ["guide", "getting-started"],
    createdAt: "2026-02-20T10:00:00.000Z",
    updatedAt: "2026-02-20T10:00:00.000Z",
    status: "active",
  },
  {
    id: "rf-002",
    title: "Latency Benchmarks",
    description: "Latest latency numbers and benchmarks.",
    tags: ["metrics", "performance"],
    createdAt: "2026-02-21T12:30:00.000Z",
    updatedAt: "2026-02-21T12:30:00.000Z",
    status: "active",
  },
  {
    id: "rf-003",
    title: "Cache Strategy",
    description: "How Routes-F cache tiers are structured.",
    tags: ["cache", "architecture"],
    createdAt: "2026-02-22T08:15:00.000Z",
    updatedAt: "2026-02-22T08:15:00.000Z",
    status: "inactive",
  },
  {
    id: "rf-004",
    title: "Feature Flags Overview",
    description: "Flag rollout plan for Routes-F experiments.",
    tags: ["flags", "rollout"],
    createdAt: "2026-02-23T09:45:00.000Z",
    updatedAt: "2026-02-23T09:45:00.000Z",
    status: "active",
  },
  {
    id: "rf-005",
    title: "Operational Playbook",
    description: "Maintenance and incident response runbook.",
    tags: ["operations", "maintenance"],
    createdAt: "2026-02-24T01:05:00.000Z",
    updatedAt: "2026-02-24T01:05:00.000Z",
    status: "active",
  },
];

let maintenanceWindows: MaintenanceWindow[] = [];

export function getRoutesFRecords(): RoutesFRecord[] {
  return [...routesFRecords];
}

export function setRoutesFRecords(records: RoutesFRecord[]) {
  routesFRecords = [...records];
}

export function getRecentRoutesFRecords(limit: number): RoutesFRecord[] {
  return [...routesFRecords]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function listRoutesFRecords(params: {
  limit: number;
  cursor?: string;
  status: string;
}): { items: RoutesFRecord[]; total: number; nextCursor: string | null } {
  const filtered = routesFRecords.filter(
    (r) => (r.status || "active") === params.status
  );

  const sorted = [...filtered].sort((a, b) => {
    // Sort by createdAt descending, then by id descending for stable sorting
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
      ]
        .join(" ")
        .toLowerCase();
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
  const startMs = Date.parse(input.start);
  const endMs = Date.parse(input.end);

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
    reason: input.reason?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const overlap = maintenanceWindows.some(window =>
    windowsOverlap(window, candidate)
  );

  if (overlap) {
    throw new Error("overlap");
  }

  maintenanceWindows = [...maintenanceWindows, candidate].sort((a, b) =>
    a.start.localeCompare(b.start)
  );

  return candidate;
}

export function clearMaintenanceWindows() {
  maintenanceWindows = [];
}

export function __test__setMaintenanceWindows(windows: MaintenanceWindow[]) {
  maintenanceWindows = [...windows];
}

export function __test__setRoutesFRecords(records: RoutesFRecord[]) {
  routesFRecords = [...records];
}
