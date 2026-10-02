/**
 * @jest-environment node
 *
 * Background job execution (#1416) against real PostgreSQL: retries,
 * dead letters, duplicate delivery, leases and the job run ledger.
 */
jest.mock("@vercel/postgres", () => ({ sql: { query: jest.fn() } }));
jest.mock("@/lib/tracing/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
const mockAlert = jest.fn();
jest.mock("@/lib/security/alerts", () => ({
  sendOperationalAlert: (...args: unknown[]) => mockAlert(...args),
}));

import { defineJob, noPayload } from "@/lib/jobs/definition";
import type { BackgroundJob } from "@/lib/jobs/definition";
import { PermanentJobError } from "@/lib/jobs/errors";
import { executeJob, type IncomingDelivery } from "@/lib/jobs/execute";
import type { JobOutcome } from "@/lib/jobs/scheduled-job";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  poolExecutor,
  TestSchema,
} from "@/test-utils/pg-test-db";

jest.setTimeout(30_000);

const OK: JobOutcome = { status: "succeeded", metrics: { done: 1 } };

function job(
  run: BackgroundJob<Record<string, never>>["run"],
  overrides: Partial<BackgroundJob<Record<string, never>>> = {}
) {
  return defineJob({
    name: "test-job",
    description: "test",
    maxAttempts: 3,
    timeoutSeconds: 5,
    leaseSeconds: 30,
    parsePayload: noPayload,
    run,
    ...overrides,
  });
}

function qstash(messageId: string, retried = 0): IncomingDelivery {
  return { trigger: "qstash", messageId, retried };
}

describeWithDb("background job execution (PostgreSQL)", () => {
  let schema: TestSchema;

  beforeEach(async () => {
    schema = await createTestSchema("jobs");
    await applyAppSchema(schema.pool);
    mockAlert.mockReset().mockResolvedValue("logged");
  });

  afterEach(async () => {
    await schema.drop();
  });

  const executor = () => poolExecutor(schema.pool);
  const deps = () => ({ executor: executor() });

  async function runs() {
    const { rows } = await schema.pool.query(
      `SELECT status, message_id, attempt, trigger, error
         FROM job_runs ORDER BY id`
    );
    return rows;
  }

  async function deadLetters() {
    const { rows } = await schema.pool.query(
      `SELECT job_name, message_id, attempts, reason, error, payload, resolved_at
         FROM job_dead_letters ORDER BY id`
    );
    return rows;
  }

  it("runs a delivery, answers 200 and records it against its message", async () => {
    const run = jest.fn().mockResolvedValue(OK);
    const execution = await executeJob(job(run), {}, qstash("m1"), deps());

    expect(execution).toMatchObject({
      httpStatus: 200,
      status: "succeeded",
      attempt: 1,
      maxAttempts: 3,
    });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {},
        delivery: { messageId: "m1", attempt: 1, trigger: "qstash" },
      })
    );
    expect(await runs()).toEqual([
      expect.objectContaining({
        status: "succeeded",
        message_id: "m1",
        attempt: 1,
        trigger: "qstash",
      }),
    ]);
  });

  it("acknowledges a duplicate delivery of a message that already succeeded without running it", async () => {
    const run = jest.fn().mockResolvedValue(OK);
    await executeJob(job(run), {}, qstash("m1"), deps());
    const again = await executeJob(job(run), {}, qstash("m1"), deps());

    expect(again).toMatchObject({ httpStatus: 200, status: "duplicate" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("asks QStash to retry a transient failure while attempts remain", async () => {
    const run = jest.fn().mockRejectedValue(new Error("db timeout"));
    const execution = await executeJob(job(run), {}, qstash("m1"), deps());

    expect(execution).toMatchObject({
      httpStatus: 500,
      status: "retry",
      attempt: 1,
      error: "db timeout",
    });
    expect(await deadLetters()).toEqual([]);
  });

  it("treats a returned 'failed' outcome like a thrown error", async () => {
    const run = jest
      .fn()
      .mockResolvedValue({ status: "failed", metrics: {} } as JobOutcome);
    const execution = await executeJob(job(run), {}, qstash("m1"), deps());
    expect(execution).toMatchObject({ httpStatus: 500, status: "retry" });
  });

  it("dead-letters a message on its last failed attempt and alerts", async () => {
    const run = jest.fn().mockRejectedValue(new Error("still broken"));
    const j = job(run);

    const first = await executeJob(j, {}, qstash("m1", 0), deps());
    const second = await executeJob(j, {}, qstash("m1", 1), deps());
    const last = await executeJob(j, {}, qstash("m1", 2), deps());

    expect([first.status, second.status, last.status]).toEqual([
      "retry",
      "retry",
      "dead_lettered",
    ]);
    // 500 on the last attempt too: QStash then moves it to its own DLQ.
    expect(last.httpStatus).toBe(500);
    expect(await deadLetters()).toEqual([
      expect.objectContaining({
        job_name: "test-job",
        message_id: "m1",
        attempts: 3,
        reason: "retries_exhausted",
        error: "still broken",
        resolved_at: null,
      }),
    ]);
    expect(mockAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "background_jobs",
        event: "job_dead_lettered",
        severity: "critical",
      })
    );
    expect((await runs()).map(r => r.attempt)).toEqual([1, 2, 3]);
  });

  it("counts attempts from the ledger when the retry header is missing", async () => {
    const run = jest.fn().mockRejectedValue(new Error("boom"));
    const j = job(run);
    await executeJob(j, {}, qstash("m1"), deps());
    await executeJob(j, {}, qstash("m1"), deps());
    const third = await executeJob(j, {}, qstash("m1"), deps());

    expect(third).toMatchObject({ attempt: 3, status: "dead_lettered" });
  });

  it("dead-letters a permanent failure at once and stops QStash retrying", async () => {
    const run = jest
      .fn()
      .mockRejectedValue(new PermanentJobError("creator was deleted"));
    const execution = await executeJob(job(run), {}, qstash("m1"), deps());

    expect(execution).toMatchObject({
      httpStatus: 200,
      status: "dead_lettered",
      attempt: 1,
    });
    expect(await deadLetters()).toEqual([
      expect.objectContaining({ reason: "permanent", attempts: 1 }),
    ]);
  });

  it("dead-letters an invalid payload without running the job", async () => {
    const run = jest.fn().mockResolvedValue(OK);
    const execution = await executeJob(
      job(run),
      { unexpected: true },
      qstash("m1"),
      deps()
    );

    expect(execution).toMatchObject({
      httpStatus: 200,
      status: "dead_lettered",
    });
    expect(run).not.toHaveBeenCalled();
    expect(await deadLetters()).toEqual([
      expect.objectContaining({
        reason: "permanent",
        payload: { unexpected: true },
        error: expect.stringContaining("invalid payload"),
      }),
    ]);
  });

  it("resolves a dead letter when a replay of the same message succeeds", async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(OK);
    const j = job(run, { maxAttempts: 1 });

    await executeJob(j, {}, qstash("m1"), deps());
    expect((await deadLetters())[0].resolved_at).toBeNull();

    // Replayed from the QStash DLQ: same message id.
    const replay = await executeJob(j, {}, qstash("m1"), deps());
    expect(replay.status).toBe("succeeded");
    expect((await deadLetters())[0].resolved_at).not.toBeNull();
  });

  it("never dead-letters an operator's manual run; the caller sees the failure", async () => {
    const run = jest.fn().mockRejectedValue(new Error("boom"));
    const execution = await executeJob(
      job(run),
      undefined,
      { trigger: "manual", messageId: null, retried: 0 },
      deps()
    );

    expect(execution).toMatchObject({
      httpStatus: 500,
      status: "failed",
      maxAttempts: 1,
    });
    expect(await deadLetters()).toEqual([]);
    expect(await runs()).toEqual([
      expect.objectContaining({ trigger: "manual", message_id: null }),
    ]);
  });

  it("fails a run that exceeds its time limit so it can be retried", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    try {
      const run = jest.fn(() => new Promise<JobOutcome>(() => undefined));
      const pending = executeJob(
        job(run, { timeoutSeconds: 2, leaseSeconds: 10 }),
        {},
        qstash("m1"),
        deps()
      );
      // Let the lease query finish before advancing the clock.
      await jest.advanceTimersByTimeAsync(0);
      while (run.mock.calls.length === 0) {
        jest.useRealTimers();
        await new Promise(resolve => setTimeout(resolve, 5));
        jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
      }
      await jest.advanceTimersByTimeAsync(2_001);
      jest.useRealTimers();
      const execution = await pending;
      expect(execution).toMatchObject({
        httpStatus: 500,
        status: "retry",
        error: expect.stringMatching(/time limit/),
      });
    } finally {
      jest.useRealTimers();
    }
  });

  describe("leases", () => {
    it("skips a delivery while another run of the same lease key is in progress", async () => {
      let release: () => void = () => undefined;
      const slow = jest.fn(
        () =>
          new Promise<JobOutcome>(resolve => {
            release = () => resolve(OK);
          })
      );
      const j = job(slow);

      const first = executeJob(j, {}, qstash("m1"), deps());
      while (slow.mock.calls.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      const second = await executeJob(j, {}, qstash("m2"), deps());
      release();

      expect(second).toMatchObject({ httpStatus: 200, status: "skipped" });
      expect((await first).status).toBe("succeeded");
      expect(slow).toHaveBeenCalledTimes(1);
    });

    it("runs different lease keys of the same job concurrently", async () => {
      interface P {
        key: string;
      }
      const started: string[] = [];
      let release: () => void = () => undefined;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const keyed = defineJob<P, unknown>({
        name: "keyed-job",
        description: "test",
        maxAttempts: 2,
        timeoutSeconds: 5,
        leaseSeconds: 30,
        leaseKey: p => `keyed-job:${p.key}`,
        parsePayload: raw => raw as P,
        run: async ({ payload }) => {
          started.push(payload.key);
          await gate;
          return OK;
        },
      });

      const a = executeJob(keyed, { key: "a" }, qstash("ma"), deps());
      const b = executeJob(keyed, { key: "b" }, qstash("mb"), deps());
      while (started.length < 2) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      release();
      expect((await a).status).toBe("succeeded");
      expect((await b).status).toBe("succeeded");
    });
  });

  it("passes a dispatch function that queues the same job", async () => {
    const dispatch = jest
      .fn()
      .mockResolvedValue({ dispatched: true, messageId: "next" });
    const j = job(async ctx => {
      await ctx.dispatch({}, { deduplicationId: "d1" });
      return OK;
    });

    await executeJob(j, {}, qstash("m1"), { executor: executor(), dispatch });

    expect(dispatch).toHaveBeenCalledWith(j, {}, { deduplicationId: "d1" });
  });
});

describe("defineJob", () => {
  const base = {
    name: "ok-job",
    description: "x",
    maxAttempts: 3,
    timeoutSeconds: 10,
    leaseSeconds: 20,
    parsePayload: noPayload,
    run: async () => OK,
  };

  it("accepts a valid definition", () => {
    expect(defineJob(base)).toBe(base);
  });

  it.each([
    [{ name: "Bad Name" }, /name/],
    [{ maxAttempts: 0 }, /maxAttempts/],
    [{ maxAttempts: 9 }, /maxAttempts/],
    [{ timeoutSeconds: 60 }, /timeoutSeconds/],
    [{ leaseSeconds: 10 }, /leaseSeconds/],
  ])("rejects %p", (override, message) => {
    expect(() => defineJob({ ...base, ...override })).toThrow(message);
  });

  it("noPayload accepts only an empty body", () => {
    expect(noPayload(undefined)).toEqual({});
    expect(noPayload({})).toEqual({});
    expect(() => noPayload({ userId: "x" })).toThrow(PermanentJobError);
  });
});
