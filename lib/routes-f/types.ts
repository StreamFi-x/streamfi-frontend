export interface RoutesFRecord {
  id: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  status?: string;
}

export interface MaintenanceWindow {
  id: string;
  start: string;
  end: string;
  reason?: string;
  createdAt: string;
}

export type MetricsKey =
  | "flags"
  | "search"
  | "export"
  | "maintenance"
  | "metrics";

export interface MetricsSnapshot {
  generatedAt: string;
  resetOnRestart: boolean;
  totals: Record<MetricsKey, number>;
  last24h: Record<MetricsKey, number>;
  series: Array<{ hourStart: string; counts: Record<MetricsKey, number> }>;
}
