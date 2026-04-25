export interface ProbeResult {
  ok: boolean;
  details: string;
}

export interface ProbeCheck extends ProbeResult {
  duration_ms: number;
  timed_out?: boolean;
}

export interface DependencyProbe {
  name: string;
  run: () => Promise<ProbeResult>;
}

export interface HealthReport {
  status: "ok" | "fail";
  uptime_seconds: number;
  checks: Record<string, ProbeCheck>;
  timestamp: string;
}
