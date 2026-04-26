import { defaultDependencyProbes } from "./probes";
import { ProbeTimeoutError, withTimeout } from "./timeout";
import type { DependencyProbe, HealthReport, ProbeCheck } from "./types";

interface BuildHealthReportOptions {
  probes?: DependencyProbe[];
  timeoutMs?: number;
  getUptimeSeconds?: () => number;
  now?: () => Date;
}

async function runProbe(
  probe: DependencyProbe,
  timeoutMs: number
): Promise<[string, ProbeCheck]> {
  const startedAt = Date.now();

  try {
    const result = await withTimeout(probe.run, timeoutMs);
    return [
      probe.name,
      {
        ok: result.ok,
        details: result.details,
        duration_ms: Date.now() - startedAt,
      },
    ];
  } catch (error) {
    if (error instanceof ProbeTimeoutError) {
      return [
        probe.name,
        {
          ok: false,
          details: `Timed out after ${timeoutMs}ms`,
          duration_ms: Date.now() - startedAt,
          timed_out: true,
        },
      ];
    }

    const details =
      error instanceof Error ? error.message : "Unexpected probe failure";

    return [
      probe.name,
      {
        ok: false,
        details,
        duration_ms: Date.now() - startedAt,
      },
    ];
  }
}

export async function buildHealthReport(
  options: BuildHealthReportOptions = {}
): Promise<HealthReport> {
  const probes = options.probes ?? defaultDependencyProbes;
  const timeoutMs = options.timeoutMs ?? 2000;
  const getUptimeSeconds = options.getUptimeSeconds ?? (() => process.uptime());
  const now = options.now ?? (() => new Date());

  const checks = Object.fromEntries(
    await Promise.all(probes.map(probe => runProbe(probe, timeoutMs)))
  );

  const status = Object.values(checks).every(check => check.ok) ? "ok" : "fail";

  return {
    status,
    uptime_seconds: Math.floor(getUptimeSeconds()),
    checks,
    timestamp: now().toISOString(),
  };
}
