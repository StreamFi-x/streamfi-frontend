import { buildHealthReport } from "../_lib/service";
import type { DependencyProbe } from "../_lib/types";

function createProbe(
  name: string,
  run: DependencyProbe["run"]
): DependencyProbe {
  return { name, run };
}

describe("buildHealthReport", () => {
  it("returns ok when all probes are healthy", async () => {
    const report = await buildHealthReport({
      probes: [
        createProbe("database", async () => ({
          ok: true,
          details: "db ok",
        })),
        createProbe("mux", async () => ({
          ok: true,
          details: "mux ok",
        })),
        createProbe("redis", async () => ({
          ok: true,
          details: "redis ok",
        })),
      ],
      getUptimeSeconds: () => 42.9,
      now: () => new Date("2026-04-25T12:00:00.000Z"),
    });

    expect(report.status).toBe("ok");
    expect(report.uptime_seconds).toBe(42);
    expect(report.timestamp).toBe("2026-04-25T12:00:00.000Z");
    expect(report.checks.database.ok).toBe(true);
    expect(report.checks.mux.ok).toBe(true);
    expect(report.checks.redis.ok).toBe(true);
  });

  it("returns fail when one probe is unhealthy", async () => {
    const report = await buildHealthReport({
      probes: [
        createProbe("database", async () => ({
          ok: true,
          details: "db ok",
        })),
        createProbe("mux", async () => ({
          ok: false,
          details: "mux unavailable",
        })),
        createProbe("redis", async () => ({
          ok: true,
          details: "redis ok",
        })),
      ],
    });

    expect(report.status).toBe("fail");
    expect(report.checks.database.ok).toBe(true);
    expect(report.checks.mux.ok).toBe(false);
    expect(report.checks.mux.details).toBe("mux unavailable");
    expect(report.checks.redis.ok).toBe(true);
  });

  it("marks a probe as timed out when it exceeds the timeout", async () => {
    const report = await buildHealthReport({
      probes: [
        createProbe("database", async () => ({
          ok: true,
          details: "db ok",
        })),
        createProbe(
          "mux",
          async () =>
            await new Promise(() => {
              return;
            })
        ),
        createProbe("redis", async () => ({
          ok: true,
          details: "redis ok",
        })),
      ],
      timeoutMs: 10,
    });

    expect(report.status).toBe("fail");
    expect(report.checks.mux.ok).toBe(false);
    expect(report.checks.mux.timed_out).toBe(true);
    expect(report.checks.mux.details).toContain("Timed out");
  });
});
