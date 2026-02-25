export interface RoutesFRecord {
  id: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  etag?: string;
}

export interface MaintenanceWindow {
  id: string;
  start: string;
  end: string;
  reason?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
}

export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface RoutesFJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  result?: any;
  error?: string;
}

export type MetricsKey =
  | "flags"
  | "search"
  | "export"
  | "maintenance"
  | "metrics"
  | "audit";

export interface MetricsSnapshot {
  generatedAt: string;
  resetOnRestart: boolean;
  totals: Record<MetricsKey, number>;
  last24h: Record<MetricsKey, number>;
  series: Array<{ hourStart: string; counts: Record<MetricsKey, number> }>;
}
