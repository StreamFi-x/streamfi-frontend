/**
 * @jest-environment node
 */
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));
jest.mock("@/utils/send-email", () => ({
  sendOpsAlertEmail: jest.fn(async () => undefined),
}));

import { sendOpsAlertEmail } from "@/utils/send-email";
import { toStroops } from "@/lib/stellar/amounts";
import {
  alertSignature,
  deliverPendingAlerts,
  evaluatePendingRuns,
  evaluateRun,
  evaluateTipReconciliationRun,
  formatAlertEmail,
  loadThresholds,
  type RunAggregate,
} from "@/lib/alerts/tip-reconciliation-alerts";

const thresholds = loadThresholds();

function run(overrides: Partial<RunAggregate> = {}): RunAggregate {
  return {
    runId: "run-x",
    status: "completed",
    startedAt: "2026-09-25T12:00:00.000Z",
    finishedAt: "2026-09-25T12:01:00.000Z",
    correctionsCount: 0,
    correctionStroops: BigInt(0),
    largestStroops: BigInt(0),
    flaggedCount: 0,
    byKind: {},
    ...overrides,
  };
}

/** A realistic trickle: 0–3 corrections of a few XLM per run. */
const normalHistory = [1, 0, 2, 3, 1, 0, 2, 1, 1, 2].map((n, i) =>
  run({
    runId: `h${i}`,
    correctionsCount: n,
    correctionStroops: toStroops(`${n * 2}`),
    largestStroops: toStroops("2"),
  })
);

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.RECONCILIATION_ALERT_EMAILS;
});

describe("evaluateRun (baseline model)", () => {
  it("does not alert on normal drift", () => {
    const evaluation = evaluateRun(
      run({ correctionsCount: 3, correctionStroops: toStroops("6") }),
      normalHistory,
      thresholds
    );
    expect(evaluation.abnormal).toBe(false);
    expect(evaluation.coldStart).toBe(false);
    expect(evaluation.baseline).toMatchObject({ runs: 10, countMedian: "1" });
  });

  it("alerts on many small corrections (count anomaly)", () => {
    const evaluation = evaluateRun(
      run({ correctionsCount: 40, correctionStroops: toStroops("40") }),
      normalHistory,
      thresholds
    );
    expect(evaluation).toMatchObject({ abnormal: true, severity: "warning" });
    expect(evaluation.reasons.map(r => r.code)).toEqual([
      "COUNT_ABOVE_BASELINE",
    ]);
  });

  it("alerts on few corrections with a large total (magnitude anomaly)", () => {
    const evaluation = evaluateRun(
      run({
        correctionsCount: 2,
        correctionStroops: toStroops("450"),
        largestStroops: toStroops("300"),
      }),
      normalHistory,
      thresholds
    );
    expect(evaluation.reasons.map(r => r.code)).toEqual([
      "MAGNITUDE_ABOVE_BASELINE",
    ]);
  });

  it("treats a single very large correction as critical regardless of baseline", () => {
    const evaluation = evaluateRun(
      run({
        correctionsCount: 1,
        correctionStroops: toStroops("600"),
        largestStroops: toStroops("600"),
      }),
      [],
      thresholds
    );
    expect(evaluation.severity).toBe("critical");
    expect(evaluation.reasons.map(r => r.code)).toContain(
      "LARGE_SINGLE_CORRECTION"
    );
  });

  it("treats ledger mismatches and failed runs as critical", () => {
    expect(
      evaluateRun(run({ flaggedCount: 1 }), normalHistory, thresholds)
    ).toMatchObject({ abnormal: true, severity: "critical" });
    expect(
      evaluateRun(run({ status: "abandoned" }), normalHistory, thresholds)
        .reasons[0].code
    ).toBe("RUN_FAILED");
  });

  it("does not alert on a first run without a baseline", () => {
    const evaluation = evaluateRun(
      run({ correctionsCount: 20, correctionStroops: toStroops("300") }),
      [],
      thresholds
    );
    expect(evaluation).toMatchObject({
      abnormal: false,
      coldStart: true,
      baseline: null,
    });
  });

  it("still alerts at cold start past the absolute safety thresholds", () => {
    const evaluation = evaluateRun(
      run({ correctionsCount: 30, correctionStroops: toStroops("1500") }),
      normalHistory.slice(0, 2),
      thresholds
    );
    expect(evaluation.reasons.map(r => r.code)).toEqual([
      "COLD_START_COUNT",
      "COLD_START_MAGNITUDE",
    ]);
  });

  it("uses the absolute floor when the baseline is all zeros", () => {
    const quiet = Array.from({ length: 10 }, (_, i) => run({ runId: `q${i}` }));
    expect(
      evaluateRun(run({ correctionsCount: 5 }), quiet, thresholds).abnormal
    ).toBe(false);
    expect(
      evaluateRun(run({ correctionsCount: 6 }), quiet, thresholds).reasons[0]
        .code
    ).toBe("COUNT_ABOVE_BASELINE");
  });

  it("is robust to a past spike in the history (median/MAD)", () => {
    const withSpike = [
      ...normalHistory,
      run({ correctionsCount: 500, correctionStroops: toStroops("5000") }),
    ];
    expect(
      evaluateRun(run({ correctionsCount: 40 }), withSpike, thresholds).abnormal
    ).toBe(true);
  });
});

describe("alertSignature", () => {
  it("is stable for the same situation and changes on escalation", () => {
    const evaluation = evaluateRun(
      run({ correctionsCount: 40, correctionStroops: toStroops("40") }),
      normalHistory,
      thresholds
    );
    const a = alertSignature(evaluation, run(), []);
    const b = alertSignature(evaluation, run(), []);
    expect(a).toBe(b);

    const mismatch = evaluateRun(
      run({ flaggedCount: 1 }),
      normalHistory,
      thresholds
    );
    expect(alertSignature(mismatch, run(), ["tx1"])).not.toBe(
      alertSignature(mismatch, run(), ["tx2"])
    );
    expect(alertSignature(mismatch, run(), ["tx1", "tx2"])).toBe(
      alertSignature(mismatch, run(), ["tx2", "tx1"])
    );
  });
});

describe("evaluateTipReconciliationRun", () => {
  function stubRun(current: Record<string, unknown>) {
    mockDb.on(/WHERE r.id = /, { rows: [current] });
    mockDb.on(/AND r.started_at < /, { rows: [] });
    mockDb.on(
      /FROM tip_reconciliation_corrections\s+WHERE run_id = \$\?\s+ORDER BY/,
      {
        rows: [
          {
            kind: "NOT_ON_LEDGER",
            applied: false,
            tx_hash: "tx-phantom",
            creator_id: "c1",
            tip_transaction_id: "t1",
            amount_before: "99.0000000",
            amount_after: null,
            delta_abs: "99.0000000",
          },
        ],
      }
    );
    mockDb.on(/INSERT INTO reconciliation_alerts/, {
      rows: [{ id: "alert-1", status: "pending" }],
    });
    mockDb.on(/SET alert_evaluated_at = now\(\)/, { rowCount: 1 });
  }

  it("stores one alert per run with a redacted payload and marks the run evaluated", async () => {
    stubRun({
      id: "run-9",
      status: "completed",
      started_at: "2026-09-25T12:00:00Z",
      finished_at: "2026-09-25T12:01:00Z",
      corrections_count: "0",
      correction_amount: "0",
      largest_correction: "0",
      flagged_count: "1",
      by_kind: { NOT_ON_LEDGER: 1 },
    });

    const result = await evaluateTipReconciliationRun("run-9", thresholds);

    expect(result).toEqual({
      abnormal: true,
      alertId: "alert-1",
      status: "pending",
    });
    const [insert] = mockDb.callsMatching(/INSERT INTO reconciliation_alerts/);
    expect(insert.values).toContain("tip-reconciliation:run:run-9");
    expect(insert.text).toMatch(/ON CONFLICT \(fingerprint\) DO NOTHING/);
    expect(insert.text).toMatch(/'suppressed'/);
    const payload = JSON.parse(String(insert.values[insert.values.length - 1]));
    expect(payload).toMatchObject({
      severity: "critical",
      run: { id: "run-9" },
      observed: { flagged_count: 1 },
      affected: [{ tx_hash: "tx-phantom", creator_id: "c1" }],
    });
    expect(JSON.stringify(payload)).not.toMatch(/wallet|email|username/i);
    expect(mockDb.callsMatching(/SET alert_evaluated_at/)).toHaveLength(1);
  });

  it("marks a normal run evaluated without creating an alert", async () => {
    stubRun({
      id: "run-ok",
      status: "completed",
      started_at: "2026-09-25T12:00:00Z",
      finished_at: null,
      corrections_count: "1",
      correction_amount: "2.0000000",
      largest_correction: "2.0000000",
      flagged_count: "0",
      by_kind: {},
    });
    const result = await evaluateTipReconciliationRun("run-ok", thresholds);
    expect(result.abnormal).toBe(false);
    expect(
      mockDb.callsMatching(/INSERT INTO reconciliation_alerts/)
    ).toHaveLength(0);
    expect(mockDb.callsMatching(/SET alert_evaluated_at/)).toHaveLength(1);
  });

  it("evaluatePendingRuns keeps going when one evaluation fails", async () => {
    mockDb.on(/alert_evaluated_at IS NULL\s+AND started_at > /, {
      rows: [{ id: "missing-run" }, { id: "run-ok" }],
    });
    mockDb.once(/WHERE r.id = /, { rows: [] });
    stubRun({
      id: "run-ok",
      status: "completed",
      started_at: "2026-09-25T12:00:00Z",
      finished_at: null,
      corrections_count: "0",
      correction_amount: "0",
      largest_correction: "0",
      flagged_count: "0",
      by_kind: {},
    });
    expect(await evaluatePendingRuns()).toEqual({ evaluated: 1, failed: 1 });
  });
});

describe("deliverPendingAlerts", () => {
  const payload = {
    severity: "critical",
    run: { id: "run-9" },
    reasons: [{ code: "LEDGER_MISMATCH", observed: "1", threshold: "0" }],
  };

  beforeEach(() => {
    mockDb.on(/SET status = 'sending'/, {
      rows: [{ id: "alert-1", payload, attempts: 1 }],
    });
    mockDb.on(/SET status = 'delivered'/, { rowCount: 1 });
    mockDb.on(/SET status = 'failed'/, { rowCount: 1 });
  });

  it("claims alerts atomically with SKIP LOCKED", async () => {
    process.env.RECONCILIATION_ALERT_EMAILS = "oncall@streamfi.test";
    await deliverPendingAlerts();
    const [claim] = mockDb.callsMatching(/SET status = 'sending'/);
    expect(claim.text).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(claim.text).toMatch(/attempts < \$\?/);
  });

  it("delivers to the configured recipients", async () => {
    process.env.RECONCILIATION_ALERT_EMAILS = "a@x.io, b@x.io";
    expect(await deliverPendingAlerts()).toEqual({ delivered: 1, failed: 0 });
    expect(sendOpsAlertEmail).toHaveBeenCalledWith(
      ["a@x.io", "b@x.io"],
      expect.stringContaining("[CRITICAL]"),
      expect.stringContaining("LEDGER_MISMATCH")
    );
  });

  it("records a failure (never 'delivered') when no channel is configured", async () => {
    expect(await deliverPendingAlerts()).toEqual({ delivered: 0, failed: 1 });
    expect(mockDb.callsMatching(/SET status = 'delivered'/)).toHaveLength(0);
    const [failed] = mockDb.callsMatching(/SET status = 'failed'/);
    expect(failed.values[0]).toMatch(/RECONCILIATION_ALERT_EMAILS/);
    expect(console.error).toHaveBeenCalled();
  });

  it("records a transport failure for retry", async () => {
    process.env.RECONCILIATION_ALERT_EMAILS = "a@x.io";
    (sendOpsAlertEmail as jest.Mock).mockRejectedValueOnce(
      new Error("SMTP 421")
    );
    expect(await deliverPendingAlerts()).toEqual({ delivered: 0, failed: 1 });
    const [failed] = mockDb.callsMatching(/SET status = 'failed'/);
    expect(failed.values[0]).toBe("SMTP 421");
  });

  it("formats an actionable email", () => {
    const { subject, text } = formatAlertEmail(payload);
    expect(subject).toBe(
      "[StreamFi][CRITICAL] Tip reconciliation anomaly (run run-9)"
    );
    expect(text).toMatch(/LEDGER_MISMATCH: observed 1, threshold 0/);
  });
});
