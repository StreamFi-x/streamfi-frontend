/**
 * @jest-environment node
 */
import { createSqlMock, type SqlCall } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => {
  const sql = (...args: unknown[]) => mockDb.sql(...args);
  // sql.query(text, params): route through the same mock.
  sql.query = (text: string, params: unknown[] = []) =>
    mockDb.sql(Object.assign([text], { raw: [text] }), ...params);
  return { sql };
});
jest.mock("@/lib/security/alerts", () => ({
  sendOperationalAlert: jest.fn(async () => "sent"),
}));
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { sendOperationalAlert } from "@/lib/security/alerts";
import { toStroops } from "@/lib/stellar/tip-reconciliation";
import {
  alertSignature,
  evaluatePendingRuns,
  evaluateRun,
  evaluateTipReconciliationRun,
  loadThresholds,
  type RunAggregate,
} from "@/lib/alerts/tip-reconciliation-alerts";

const thresholds = loadThresholds();
const sendAlert = sendOperationalAlert as jest.Mock;

function run(overrides: Partial<RunAggregate> = {}): RunAggregate {
  return {
    runId: "run-x",
    status: "succeeded",
    startedAt: "2026-09-25T12:00:00.000Z",
    correctionsCount: 0,
    correctionStroops: BigInt(0),
    largestStroops: BigInt(0),
    decreasedCount: 0,
    tipsInserted: 0,
    ...overrides,
  };
}

/** A realistic trickle: 0–3 corrected totals of a few XLM per run. */
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

  it("treats a total corrected downwards and a failed run as critical", () => {
    expect(
      evaluateRun(run({ decreasedCount: 1 }), normalHistory, thresholds)
    ).toMatchObject({ abnormal: true, severity: "critical" });
    expect(
      evaluateRun(run({ status: "failed" }), normalHistory, thresholds)
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
  it("is stable for the same situation and changes with the affected users", () => {
    const evaluation = evaluateRun(
      run({ correctionsCount: 40, correctionStroops: toStroops("40") }),
      normalHistory,
      thresholds
    );
    expect(alertSignature(evaluation, run(), [])).toBe(
      alertSignature(evaluation, run(), [])
    );

    const decreased = evaluateRun(
      run({ decreasedCount: 1 }),
      normalHistory,
      thresholds
    );
    expect(alertSignature(decreased, run(), ["u1"])).not.toBe(
      alertSignature(decreased, run(), ["u2"])
    );
    expect(alertSignature(decreased, run(), ["u1", "u2"])).toBe(
      alertSignature(decreased, run(), ["u2", "u1"])
    );
  });
});

describe("evaluateTipReconciliationRun", () => {
  function stubRun(current: Record<string, unknown>, claimed = true) {
    mockDb.on(/WHERE r\.run_id = \$1/, { rows: [current] });
    mockDb.on(/AND r\.started_at < \$2::timestamptz/, { rows: [] });
    mockDb.on(/FROM tip_reconciliation_corrections\s+WHERE run_id = \$\?/, {
      rows: [
        {
          kind: "TOTALS_CORRECTED",
          user_id: "u1",
          tx_hash: null,
          amount_before: "120.0000000",
          amount_after: "20.0000000",
          delta: "-100.0000000",
        },
        {
          kind: "TIP_INSERTED",
          user_id: "u2",
          tx_hash: "tx-new",
          amount_before: null,
          amount_after: "3.0000000",
          delta: "3.0000000",
        },
      ],
    });
    mockDb.on(/INSERT INTO reconciliation_alerts/, {
      rows: [{ id: "alert-1" }],
    });
    mockDb.on(/SET delivered_at = now\(\)/, {
      rows: claimed ? [{ id: "alert-1" }] : [],
    });
    mockDb.on(/SET delivery = /, { rowCount: 1 });
    mockDb.on(/SET alert_evaluated_at = now\(\)/, { rowCount: 1 });
  }

  const abnormalRow = {
    run_id: "run-9",
    status: "succeeded",
    started_at: "2026-09-25T12:00:00Z",
    corrections_count: "1",
    correction_amount: "100.0000000",
    largest_correction: "100.0000000",
    decreased_count: "1",
    tips_inserted: "1",
  };

  it("stores one alert per run and delivers it through the operational channel", async () => {
    stubRun(abnormalRow);

    const result = await evaluateTipReconciliationRun("run-9", thresholds);

    expect(result).toEqual({
      abnormal: true,
      alertId: "alert-1",
      delivery: "sent",
    });
    const [insert] = mockDb.callsMatching(/INSERT INTO reconciliation_alerts/);
    expect(insert.values).toContain("tip-total-reconciliation:run:run-9");
    expect(insert.text).toMatch(/ON CONFLICT \(fingerprint\)/);
    const payload = JSON.parse(String(insert.values[insert.values.length - 1]));
    expect(payload).toMatchObject({
      severity: "critical",
      run: { id: "run-9" },
      observed: { decreased_totals: 1, tips_inserted: 1 },
      affected: [{ user_id: "u1" }, { tx_hash: "tx-new" }],
    });
    expect(JSON.stringify(payload)).not.toMatch(/wallet|email|username/i);

    expect(sendAlert).toHaveBeenCalledTimes(1);
    const alert = sendAlert.mock.calls[0][0];
    expect(alert).toMatchObject({
      category: "tip_reconciliation",
      severity: "critical",
      details: expect.objectContaining({
        run_id: "run-9",
        affected_tx_hashes: "tx-new",
        reasons: expect.stringContaining("TOTAL_DECREASED"),
      }),
    });
    expect(alert.dedupKey).toMatch(/^tip_reconciliation:TOTAL_DECREASED/);
    const delivery = mockDb.callsMatching(/SET delivery = /)[0];
    expect(delivery.values).toContain("sent");
    expect(mockDb.callsMatching(/SET alert_evaluated_at/)).toHaveLength(1);
  });

  it("never sends the same stored alert twice when an evaluation is retried", async () => {
    stubRun(abnormalRow, false);
    const result = await evaluateTipReconciliationRun("run-9", thresholds);
    expect(result.delivery).toBeNull();
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it("records a log-only delivery honestly", async () => {
    stubRun(abnormalRow);
    sendAlert.mockResolvedValueOnce("logged");
    const result = await evaluateTipReconciliationRun("run-9", thresholds);
    expect(result.delivery).toBe("logged");
    expect(mockDb.callsMatching(/SET delivery = /)[0].values).toContain(
      "logged"
    );
  });

  it("marks a normal run evaluated without creating an alert", async () => {
    stubRun({
      ...abnormalRow,
      corrections_count: "1",
      correction_amount: "2.0000000",
      largest_correction: "2.0000000",
      decreased_count: "0",
    });
    const result = await evaluateTipReconciliationRun("run-9", thresholds);
    expect(result.abnormal).toBe(false);
    expect(
      mockDb.callsMatching(/INSERT INTO reconciliation_alerts/)
    ).toHaveLength(0);
    expect(sendAlert).not.toHaveBeenCalled();
    expect(mockDb.callsMatching(/SET alert_evaluated_at/)).toHaveLength(1);
  });

  it("builds the baseline from previous completed runs of the job", async () => {
    stubRun(abnormalRow);
    await evaluateTipReconciliationRun("run-9", thresholds);
    const [history] = mockDb.callsMatching(
      /AND r\.started_at < \$2::timestamptz/
    );
    expect(history.values[0]).toBe("tip-total-reconciliation");
    expect(history.text).toMatch(/r\.status IN \('succeeded', 'partial'\)/);
    expect(history.text).toMatch(/LEFT JOIN tip_reconciliation_corrections/);
  });

  it("evaluatePendingRuns keeps going when one evaluation fails", async () => {
    mockDb.on(/alert_evaluated_at IS NULL\s+AND started_at > /, {
      rows: [{ run_id: "missing-run" }, { run_id: "run-9" }],
    });
    mockDb.once(/WHERE r\.run_id = \$1/, { rows: [] });
    stubRun({
      ...abnormalRow,
      decreased_count: "0",
      correction_amount: "0",
      largest_correction: "0",
      corrections_count: "0",
    });
    expect(await evaluatePendingRuns(thresholds)).toEqual({
      evaluated: 1,
      failed: 1,
    });
  });

  it("only picks up finished, unevaluated runs of this job", async () => {
    mockDb.on(
      /alert_evaluated_at IS NULL\s+AND started_at > /,
      (call: SqlCall) => {
        expect(call.values).toContain("tip-total-reconciliation");
        expect(call.text).toMatch(/status <> 'skipped'/);
        expect(call.text).toMatch(/run_id IS NOT NULL/);
        return { rows: [] };
      }
    );
    expect(await evaluatePendingRuns(thresholds)).toEqual({
      evaluated: 0,
      failed: 0,
    });
  });
});
