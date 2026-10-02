export type ExportMetric = "revenue" | "viewers";

export interface DailyMetricPoint {
  /** ISO date (YYYY-MM-DD), one row per day in the requested range. */
  date: string;
  value: number;
}

export interface MetricSeries {
  metric: ExportMetric;
  channel_id: string;
  points: DailyMetricPoint[];
}
