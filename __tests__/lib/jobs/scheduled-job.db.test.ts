/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: { query: jest.fn() } }));
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from "@/lib/tracing/logger";
import {
  acquireJobLease,
  releaseJobLease,
  runScheduledJob,
} from "@/lib/jobs/scheduled-job";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  poolExecutor,
  TestSchema,
} from "@/test-utils/pg-test-db";

jest.setTimeout(30_000);

const errorLog = logger.error as jest.Mock;

function alertMessages(): string[] {
  return errorLog.mock.calls
    .map(call => String(call[0]))
    .filter(message => message.startsWith("[job-alert]"));
}

describeWithDb("scheduled job infrastructure (PostgreSQL)", () => {
  let schema: TestSchema;

  beforeEach(async () => {
    schema = await createTestSchema("jobs");
    await applyAppSchema(schema.pool);
    errorLog.mockClear();
  });

  afterEach(async () => {
    await schema.drop();
  });

  const executor = () => poolExecutor(schema.pool);

  async function runs() {
    const { rows } = await schema.pool.query(
      "SELECT job_name, status, metrics, error FROM job_runs ORDER BY id"
    );
    return rows;
  }

  describe("job lease", () => {
    it("grants the lease to exactly one of many concurrent callers", async () => {
      const holders = await Promise.all(
        Array.from({ length: 10 }, () =>
          acquireJobLease("lease-test", 60, executor())
        )
      );
      expect(holders.filter(Boolean)).toHaveLength(1);
    });

    it("can be re-acquired after release", async () => {
      const holder = await acquireJobLease("lease-test", 60, executor());
      await releaseJobLease("lease-test", holder!, executor());
      expect(await acquireJobLease("lease-test", 60, executor())).toBeTruthy();
    });

    it("only the holder can release it", async () => {
      await acquireJobLease("lease-test", 60, executor());
      await releaseJobLease("lease-test", "someone-else", executor());
      expect(await acquireJobLease("lease-test", 60, executor())).toBeNull();
    });

    it("expires on its own after a crash", async () => {
      await acquireJobLease("lease-test", 60, executor());
      await schema.pool.query(
        "UPDATE job_locks SET locked_until = NOW() - interval '1 second'"
      );
      expect(await acquireJobLease("lease-test", 60, executor())).toBeTruthy();
    });
  });

  it("records a successful run with its metrics and releases the lease", async () => {
    const result = await runScheduledJob({
      name: "job-a",
      leaseSeconds: 60,
      expectedIntervalSeconds: 600,
      executor: executor(),
      run: async () => ({ status: "succeeded", metrics: { processed: 3 } }),
    });

    expect(result.status).toBe("succeeded");
    expect(await runs()).toEqual([
      expect.objectContaining({
        job_name: "job-a",
        status: "succeeded",
        metrics: { processed: 3 },
      }),
    ]);
    const { rows } = await schema.pool.query(
      "SELECT COUNT(*)::int AS n FROM job_locks"
    );
    expect(rows[0].n).toBe(0);
  });

  it("skips an overlapping invocation instead of running twice", async () => {
    let release: () => void = () => undefined;
    const blocker = new Promise<void>(resolve => {
      release = resolve;
    });
    const body = jest.fn(async () => {
      await blocker;
      return { status: "succeeded" as const, metrics: {} };
    });
    const options = {
      name: "job-overlap",
      leaseSeconds: 60,
      expectedIntervalSeconds: 600,
      executor: executor(),
      run: body,
    };

    const first = runScheduledJob(options);
    await new Promise(resolve => setTimeout(resolve, 100));
    const second = await runScheduledJob(options);
    release();
    await first;

    expect(second.status).toBe("skipped");
    expect(body).toHaveBeenCalledTimes(1);
    expect((await runs()).map(r => r.status).sort()).toEqual([
      "skipped",
      "succeeded",
    ]);
  });

  it("records a failed run, releases the lease and alerts after repeated failures", async () => {
    const options = {
      name: "job-fail",
      leaseSeconds: 60,
      expectedIntervalSeconds: 600,
      failureAlertThreshold: 3,
      executor: executor(),
      run: async (): Promise<never> => {
        throw new Error("horizon down");
      },
    };

    await runScheduledJob(options);
    await runScheduledJob(options);
    expect(alertMessages()).toEqual([]);

    const third = await runScheduledJob(options);

    expect(third).toEqual(
      expect.objectContaining({ status: "failed", error: "horizon down" })
    );
    expect(alertMessages()).toEqual([
      expect.stringMatching(
        /job-fail: 3 consecutive failed runs \(latest: horizon down\)/
      ),
    ]);
  });

  it("alerts when the job has not succeeded for three intervals", async () => {
    await schema.pool.query(
      `INSERT INTO job_runs (job_name, status, started_at, duration_ms)
       VALUES ('job-gap', 'succeeded', NOW() - interval '2 hours', 10)`
    );

    await runScheduledJob({
      name: "job-gap",
      leaseSeconds: 60,
      expectedIntervalSeconds: 600,
      executor: executor(),
      run: async () => ({ status: "succeeded", metrics: {} }),
    });

    expect(alertMessages()).toEqual([
      expect.stringMatching(/job-gap: no successful run for 120 minutes/),
    ]);
  });

  it("forwards the job's own aggregated alerts once each", async () => {
    await runScheduledJob({
      name: "job-own-alert",
      leaseSeconds: 60,
      expectedIntervalSeconds: 600,
      executor: executor(),
      run: async () => ({
        status: "partial",
        metrics: { closed: 9 },
        alerts: ["abnormal correction rate"],
      }),
    });

    expect(alertMessages()).toEqual([
      "[job-alert] job-own-alert: abnormal correction rate",
    ]);
  });
});
