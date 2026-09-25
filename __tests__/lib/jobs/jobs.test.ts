/**
 * @jest-environment node
 */
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));

import { acquireLease, renewLease } from "@/lib/jobs/lease";
import { runScheduledJob } from "@/lib/jobs/run-job";
import { createDeadline, withRetry } from "@/lib/jobs/retry";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";

beforeEach(() => {
  mockDb.reset();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("job leases", () => {
  it("acquires only when the returned holder is ours", async () => {
    mockDb.on(/INSERT INTO job_leases/, call => ({
      rows: [{ holder: call.values[1] }],
    }));
    const lease = await acquireLease("job", 600);
    expect(lease).toMatchObject({ jobName: "job" });
    const [call] = mockDb.calls;
    expect(call.text).toMatch(/WHERE job_leases.lease_until < now\(\)/);
  });

  it("does not acquire a lease another worker holds", async () => {
    mockDb.on(/INSERT INTO job_leases/, { rows: [] });
    expect(await acquireLease("job", 600)).toBeNull();
  });

  it("reports a lost lease on renewal", async () => {
    mockDb.on(/UPDATE job_leases/, { rows: [] });
    expect(await renewLease({ jobName: "job", holder: "h" }, 600)).toBe(false);
  });
});

describe("runScheduledJob", () => {
  function stubLease(acquired: boolean) {
    mockDb.on(/INSERT INTO job_leases/, call => ({
      rows: acquired ? [{ holder: call.values[1] }] : [],
    }));
    mockDb.on(/UPDATE job_leases/, { rowCount: 1 });
    mockDb.on(/SET status = 'abandoned'/, { rowCount: 0 });
    mockDb.on(/INSERT INTO job_runs/, { rows: [{ id: "run-1" }] });
    mockDb.on(/UPDATE job_runs/, { rowCount: 1 });
  }

  it("skips when another worker holds the lease", async () => {
    stubLease(false);
    const body = jest.fn();
    const result = await runScheduledJob(
      "job",
      { leaseSeconds: 60, budgetMs: 1000 },
      body
    );
    expect(result).toEqual({ outcome: "skipped_locked", job: "job" });
    expect(body).not.toHaveBeenCalled();
    expect(mockDb.callsMatching(/INSERT INTO job_runs/)).toHaveLength(0);
  });

  it("closes stale runs, records metrics and releases the lease", async () => {
    stubLease(true);
    const result = await runScheduledJob(
      "job",
      { leaseSeconds: 60, budgetMs: 1000 },
      async ({ runId }) => ({ status: "completed", metrics: { runId, n: 3 } })
    );
    expect(result).toMatchObject({ outcome: "completed", runId: "run-1" });
    expect(mockDb.callsMatching(/SET status = 'abandoned'/)).toHaveLength(1);
    const finish = mockDb.callsMatching(
      /UPDATE job_runs\s+SET status = \$\?/
    )[0];
    expect(finish.values[0]).toBe("completed");
    expect(JSON.parse(String(finish.values[1]))).toMatchObject({ n: 3 });
    expect(mockDb.callsMatching(/SET lease_until = now\(\)/)).toHaveLength(1);
  });

  it("records a failure and still releases the lease", async () => {
    stubLease(true);
    const result = await runScheduledJob(
      "job",
      { leaseSeconds: 60, budgetMs: 1000 },
      async () => {
        throw new Error("boom");
      }
    );
    expect(result).toMatchObject({ outcome: "failed", error: "boom" });
    const finish = mockDb.callsMatching(
      /UPDATE job_runs\s+SET status = \$\?/
    )[0];
    expect(finish.values).toContain("failed");
    expect(finish.values).toContain("boom");
    expect(mockDb.callsMatching(/SET lease_until = now\(\)/)).toHaveLength(1);
  });
});

describe("withRetry", () => {
  const noSleep = async () => {};

  it("retries transient errors with backoff, then succeeds", async () => {
    const sleeps: number[] = [];
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("503"))
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValue("ok");
    await expect(
      withRetry(fn, {
        attempts: 3,
        baseDelayMs: 100,
        isRetryable: () => true,
        sleep: async ms => {
          sleeps.push(ms);
        },
      })
    ).resolves.toBe("ok");
    expect(sleeps).toHaveLength(2);
    expect(sleeps[1]).toBeGreaterThanOrEqual(200);
  });

  it("does not retry permanent errors", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("404"));
    await expect(
      withRetry(fn, {
        attempts: 5,
        baseDelayMs: 1,
        isRetryable: () => false,
        sleep: noSleep,
      })
    ).rejects.toThrow("404");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempt limit", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("timeout"));
    await expect(
      withRetry(fn, {
        attempts: 3,
        baseDelayMs: 1,
        isRetryable: () => true,
        sleep: noSleep,
      })
    ).rejects.toThrow("timeout");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("createDeadline", () => {
  it("expires after the budget", () => {
    let now = 1000;
    const deadline = createDeadline(500, () => now);
    expect(deadline.expired()).toBe(false);
    now = 1500;
    expect(deadline.expired()).toBe(true);
  });
});

describe("isAuthorizedCronRequest", () => {
  const req = (auth?: string) =>
    new Request("http://localhost/api/cron/x", {
      headers: auth ? { authorization: auth } : {},
    });

  it("requires CRON_SECRET to be configured", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCronRequest(req("Bearer "))).toBe(false);
    expect(isAuthorizedCronRequest(req("Bearer undefined"))).toBe(false);
  });

  it("accepts only the exact bearer token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(isAuthorizedCronRequest(req("Bearer s3cret"))).toBe(true);
    expect(isAuthorizedCronRequest(req("Bearer s3cre"))).toBe(false);
    expect(isAuthorizedCronRequest(req("s3cret"))).toBe(false);
    expect(isAuthorizedCronRequest(req())).toBe(false);
  });
});
