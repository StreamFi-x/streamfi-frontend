/**
 * Anomaly alerting for the tip reconciliation job (#1405).
 * See docs/data-integrity.md for the model and its tuning.
 *
 * The job (lib/stellar/tip-reconciliation.ts, #1400, cron
 * tip-total-reconciliation) records every change it makes in
 * tip_reconciliation_corrections, in the same statement as the change, keyed
 * by job_runs.run_id. This module only reads those rows and job_runs, so it
 * cannot disagree with what the job actually did.
 *
 * Model — per run, compared with up to BASELINE_RUNS previous runs:
 *   count      users whose tip totals were corrected
 *   magnitude  sum |delta| of those corrections (exact, in stroops)
 * For each metric: threshold = max(absolute floor,
 *                                  median + K × 1.4826 × MAD,
 *                                  RATIO × median)
 * Median/MAD are robust to the occasional spike, so one incident does not
 * inflate the baseline for the next. Independently of the baseline:
 *   - any single correction >= SINGLE_CORRECTION_XLM          (critical)
 *   - any total corrected downwards: the ledger shows less than was
 *     recorded, which timing drift cannot explain              (critical)
 *   - a failed run                                             (critical)
 * Cold start (< MIN_BASELINE_RUNS prior runs): only the absolute cold-start
 * thresholds and the baseline-independent rules above apply.
 */
import { createHash } from "crypto";
import { sql } from "@vercel/postgres";
import { fromStroops, toStroops } from "@/lib/stellar/tip-reconciliation";
import { sendOperationalAlert, type AlertOutcome } from "@/lib/security/alerts";
import { logger } from "@/lib/tracing/logger";

export const TIP_RECONCILIATION_JOB = "tip-total-reconciliation";
const ALERT_SOURCE = "tip-reconciliation";
const MAX_AFFECTED_IN_PAYLOAD = 50;
const MAX_AFFECTED_IN_MESSAGE = 10;

export interface AlertThresholds {
  baselineRuns: number;
  minBaselineRuns: number;
  madMultiplier: number;
  ratioMultiplier: number;
  countFloor: number;
  magnitudeFloorXlm: string;
  singleCorrectionXlm: string;
  coldStartCount: number;
  coldStartMagnitudeXlm: string;
  cooldownHours: number;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envAmount(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  toStroops(value); // throws on a malformed amount: fail loudly, not silently
  return value;
}

export function loadThresholds(): AlertThresholds {
  return {
    baselineRuns: envNumber("TIP_ALERT_BASELINE_RUNS", 30),
    minBaselineRuns: envNumber("TIP_ALERT_MIN_BASELINE_RUNS", 5),
    madMultiplier: envNumber("TIP_ALERT_MAD_MULTIPLIER", 4),
    ratioMultiplier: envNumber("TIP_ALERT_RATIO_MULTIPLIER", 3),
    countFloor: envNumber("TIP_ALERT_COUNT_FLOOR", 5),
    magnitudeFloorXlm: envAmount("TIP_ALERT_MAGNITUDE_FLOOR_XLM", "100"),
    singleCorrectionXlm: envAmount("TIP_ALERT_SINGLE_CORRECTION_XLM", "500"),
    coldStartCount: envNumber("TIP_ALERT_COLD_START_COUNT", 25),
    coldStartMagnitudeXlm: envAmount(
      "TIP_ALERT_COLD_START_MAGNITUDE_XLM",
      "1000"
    ),
    cooldownHours: envNumber("TIP_ALERT_COOLDOWN_HOURS", 6),
  };
}

// ── pure evaluation ──────────────────────────────────────────────────────────

export interface RunAggregate {
  runId: string;
  status: string;
  startedAt: string;
  correctionsCount: number;
  correctionStroops: bigint;
  largestStroops: bigint;
  decreasedCount: number;
  tipsInserted: number;
}

export type ReasonCode =
  | "RUN_FAILED"
  | "TOTAL_DECREASED"
  | "LARGE_SINGLE_CORRECTION"
  | "COUNT_ABOVE_BASELINE"
  | "MAGNITUDE_ABOVE_BASELINE"
  | "COLD_START_COUNT"
  | "COLD_START_MAGNITUDE";

export interface AlertReason {
  code: ReasonCode;
  observed: string;
  threshold: string;
}

export interface BaselineStats {
  runs: number;
  countMedian: string;
  countMad: string;
  countThreshold: string;
  magnitudeMedianXlm: string;
  magnitudeMadXlm: string;
  magnitudeThresholdXlm: string;
}

export interface Evaluation {
  abnormal: boolean;
  severity: "warning" | "critical";
  reasons: AlertReason[];
  coldStart: boolean;
  baseline: BaselineStats | null;
}

const CRITICAL: ReasonCode[] = [
  "RUN_FAILED",
  "TOTAL_DECREASED",
  "LARGE_SINGLE_CORRECTION",
];

function median(values: bigint[]): bigint {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / BigInt(2);
}

function mad(values: bigint[], center: bigint): bigint {
  return median(values.map(v => (v > center ? v - center : center - v)));
}

function maxBig(...values: bigint[]): bigint {
  return values.reduce((a, b) => (b > a ? b : a));
}

/** Scale a bigint by a decimal factor (4 decimal places of precision). */
function scale(value: bigint, factor: number): bigint {
  return (value * BigInt(Math.round(factor * 10000))) / BigInt(10000);
}

/**
 * threshold = max(floor, median + K × 1.4826 × MAD, RATIO × median).
 * 1.4826 makes MAD a consistent estimator of the standard deviation.
 */
function robustThreshold(
  values: bigint[],
  floor: bigint,
  t: AlertThresholds
): { median: bigint; mad: bigint; threshold: bigint } {
  const m = median(values);
  const d = mad(values, m);
  return {
    median: m,
    mad: d,
    threshold: maxBig(
      floor,
      m + scale(d, t.madMultiplier * 1.4826),
      scale(m, t.ratioMultiplier)
    ),
  };
}

export function evaluateRun(
  run: RunAggregate,
  history: RunAggregate[],
  t: AlertThresholds
): Evaluation {
  const reasons: AlertReason[] = [];

  if (run.status === "failed") {
    reasons.push({ code: "RUN_FAILED", observed: run.status, threshold: "-" });
  }
  if (run.decreasedCount > 0) {
    reasons.push({
      code: "TOTAL_DECREASED",
      observed: String(run.decreasedCount),
      threshold: "0",
    });
  }
  const single = toStroops(t.singleCorrectionXlm);
  if (run.largestStroops >= single) {
    reasons.push({
      code: "LARGE_SINGLE_CORRECTION",
      observed: fromStroops(run.largestStroops),
      threshold: t.singleCorrectionXlm,
    });
  }

  const coldStart = history.length < t.minBaselineRuns;
  let baseline: BaselineStats | null = null;
  const count = BigInt(run.correctionsCount);

  if (coldStart) {
    if (run.correctionsCount >= t.coldStartCount) {
      reasons.push({
        code: "COLD_START_COUNT",
        observed: String(run.correctionsCount),
        threshold: String(t.coldStartCount),
      });
    }
    if (run.correctionStroops >= toStroops(t.coldStartMagnitudeXlm)) {
      reasons.push({
        code: "COLD_START_MAGNITUDE",
        observed: fromStroops(run.correctionStroops),
        threshold: t.coldStartMagnitudeXlm,
      });
    }
  } else {
    const counts = robustThreshold(
      history.map(h => BigInt(h.correctionsCount)),
      BigInt(t.countFloor),
      t
    );
    const magnitudes = robustThreshold(
      history.map(h => h.correctionStroops),
      toStroops(t.magnitudeFloorXlm),
      t
    );
    baseline = {
      runs: history.length,
      countMedian: counts.median.toString(),
      countMad: counts.mad.toString(),
      countThreshold: counts.threshold.toString(),
      magnitudeMedianXlm: fromStroops(magnitudes.median),
      magnitudeMadXlm: fromStroops(magnitudes.mad),
      magnitudeThresholdXlm: fromStroops(magnitudes.threshold),
    };
    if (count > counts.threshold) {
      reasons.push({
        code: "COUNT_ABOVE_BASELINE",
        observed: count.toString(),
        threshold: counts.threshold.toString(),
      });
    }
    if (run.correctionStroops > magnitudes.threshold) {
      reasons.push({
        code: "MAGNITUDE_ABOVE_BASELINE",
        observed: fromStroops(run.correctionStroops),
        threshold: fromStroops(magnitudes.threshold),
      });
    }
  }

  return {
    abnormal: reasons.length > 0,
    severity: reasons.some(r => CRITICAL.includes(r.code))
      ? "critical"
      : "warning",
    reasons,
    coldStart,
    baseline,
  };
}

/**
 * Two alerts with the same signature describe the same situation; the
 * delivery layer sends it at most once per cooldown (dedup key). The signature
 * includes the order of magnitude of the correction amount (an escalation
 * re-alerts) and the users whose totals went down (a new affected user
 * re-alerts; the same one does not page every run).
 */
export function alertSignature(
  evaluation: Evaluation,
  run: RunAggregate,
  decreasedUsers: string[]
): string {
  const codes = evaluation.reasons.map(r => r.code).sort();
  const parts = [codes.join("+")];
  if (
    codes.some(c => c.includes("MAGNITUDE") || c === "LARGE_SINGLE_CORRECTION")
  ) {
    const xlm = fromStroops(run.correctionStroops).split(".")[0];
    parts.push(`mag${xlm.length}`);
  }
  if (decreasedUsers.length > 0) {
    parts.push(
      createHash("sha256")
        .update([...decreasedUsers].sort().join(","))
        .digest("hex")
        .slice(0, 16)
    );
  }
  return parts.join("|");
}

// ── persistence ──────────────────────────────────────────────────────────────

const AGGREGATE_COLUMNS = `
  r.run_id, r.status, r.started_at,
  count(c.id) FILTER (WHERE c.kind = 'TOTALS_CORRECTED') AS corrections_count,
  COALESCE(sum(abs(c.delta)) FILTER (WHERE c.kind = 'TOTALS_CORRECTED'), 0)::text AS correction_amount,
  COALESCE(max(abs(c.delta)) FILTER (WHERE c.kind = 'TOTALS_CORRECTED'), 0)::text AS largest_correction,
  count(c.id) FILTER (WHERE c.kind = 'TOTALS_CORRECTED' AND c.delta < 0) AS decreased_count,
  count(c.id) FILTER (WHERE c.kind = 'TIP_INSERTED') AS tips_inserted`;

function toAggregate(row: Record<string, unknown>): RunAggregate {
  return {
    runId: String(row.run_id),
    status: String(row.status),
    startedAt: new Date(String(row.started_at)).toISOString(),
    correctionsCount: Number(row.corrections_count),
    correctionStroops: toStroops(String(row.correction_amount)),
    largestStroops: toStroops(String(row.largest_correction)),
    decreasedCount: Number(row.decreased_count),
    tipsInserted: Number(row.tips_inserted),
  };
}

async function loadRun(runId: string): Promise<RunAggregate | null> {
  const { rows } = await sql.query(
    `SELECT ${AGGREGATE_COLUMNS}
       FROM job_runs r
       LEFT JOIN tip_reconciliation_corrections c ON c.run_id = r.run_id
      WHERE r.run_id = $1
      GROUP BY r.run_id, r.status, r.started_at`,
    [runId]
  );
  return rows[0] ? toAggregate(rows[0]) : null;
}

/** Previous completed runs; runs without corrections count as zeros. */
async function loadHistory(
  before: string,
  limit: number
): Promise<RunAggregate[]> {
  const { rows } = await sql.query(
    `SELECT ${AGGREGATE_COLUMNS}
       FROM job_runs r
       LEFT JOIN tip_reconciliation_corrections c ON c.run_id = r.run_id
      WHERE r.job_name = $1
        AND r.run_id IS NOT NULL
        AND r.status IN ('succeeded', 'partial')
        AND r.started_at < $2::timestamptz
      GROUP BY r.run_id, r.status, r.started_at
      ORDER BY r.started_at DESC
      LIMIT $3`,
    [TIP_RECONCILIATION_JOB, before, limit]
  );
  return rows.map(toAggregate);
}

async function loadAffected(runId: string) {
  const { rows } = await sql`
    SELECT kind, user_id, tx_hash, amount_before::text, amount_after::text,
           delta::text, count_before, count_after
    FROM tip_reconciliation_corrections
    WHERE run_id = ${runId}
    ORDER BY abs(delta) DESC
    LIMIT ${MAX_AFFECTED_IN_PAYLOAD}
  `;
  return rows;
}

export interface EvaluationResult {
  abnormal: boolean;
  alertId: string | null;
  delivery: AlertOutcome | null;
}

/**
 * Evaluate one finished run and, if it is abnormal, store and deliver an
 * alert. Idempotent: the alert fingerprint is the run id, a stored alert is
 * delivered at most once, and the run is marked evaluated at the end.
 */
export async function evaluateTipReconciliationRun(
  runId: string,
  thresholds: AlertThresholds = loadThresholds()
): Promise<EvaluationResult> {
  const run = await loadRun(runId);
  if (!run) {
    throw new Error(`run ${runId} not found`);
  }
  const history = await loadHistory(run.startedAt, thresholds.baselineRuns);
  const evaluation = evaluateRun(run, history, thresholds);

  let alertId: string | null = null;
  let delivery: AlertOutcome | null = null;
  if (evaluation.abnormal) {
    const affected = await loadAffected(runId);
    const decreasedUsers = affected
      .filter(
        a => a.kind === "TOTALS_CORRECTED" && String(a.delta).startsWith("-")
      )
      .map(a => String(a.user_id));
    const signature = alertSignature(evaluation, run, decreasedUsers);
    const payload = {
      source: ALERT_SOURCE,
      severity: evaluation.severity,
      run: { id: run.runId, status: run.status, started_at: run.startedAt },
      observed: {
        corrections_count: run.correctionsCount,
        correction_amount_xlm: fromStroops(run.correctionStroops),
        largest_correction_xlm: fromStroops(run.largestStroops),
        decreased_totals: run.decreasedCount,
        tips_inserted: run.tipsInserted,
      },
      reasons: evaluation.reasons,
      cold_start: evaluation.coldStart,
      baseline: evaluation.baseline,
      // Transaction hashes are public on-chain data; users are identified by
      // id only (no usernames, wallets or emails).
      affected: affected.map(a => ({
        kind: a.kind,
        user_id: a.user_id,
        tx_hash: a.tx_hash,
        amount_before_xlm: a.amount_before,
        amount_after_xlm: a.amount_after,
        delta_xlm: a.delta,
      })),
    };

    const { rows } = await sql`
      INSERT INTO reconciliation_alerts (fingerprint, source, run_id, severity, signature, payload)
      VALUES (
        ${`${TIP_RECONCILIATION_JOB}:run:${runId}`}, ${ALERT_SOURCE}, ${runId},
        ${evaluation.severity}, ${signature}, ${JSON.stringify(payload)}::jsonb
      )
      ON CONFLICT (fingerprint) DO UPDATE SET fingerprint = EXCLUDED.fingerprint
      RETURNING id
    `;
    alertId = String(rows[0].id);
    delivery = await deliverAlert(
      alertId,
      evaluation,
      run,
      payload,
      signature,
      thresholds
    );
  }

  await sql`
    UPDATE job_runs SET alert_evaluated_at = now()
    WHERE run_id = ${runId} AND alert_evaluated_at IS NULL
  `;

  logger.info("tip_reconciliation_alert_evaluated", {
    runId,
    abnormal: evaluation.abnormal,
    severity: evaluation.abnormal ? evaluation.severity : null,
    reasons: evaluation.reasons.map(r => r.code).join(","),
    coldStart: evaluation.coldStart,
    alertId,
    delivery,
  });
  return { abnormal: evaluation.abnormal, alertId, delivery };
}

/**
 * Sends a stored alert through the shared operational alert channel. The
 * conditional claim (delivered_at IS NULL) means a retried evaluation never
 * sends the same alert twice; sendOperationalAlert additionally de-duplicates
 * by signature within the cooldown and never throws.
 */
async function deliverAlert(
  alertId: string,
  evaluation: Evaluation,
  run: RunAggregate,
  payload: { affected: Array<{ user_id: unknown; tx_hash: unknown }> },
  signature: string,
  t: AlertThresholds
): Promise<AlertOutcome | null> {
  const { rows: claimed } = await sql`
    UPDATE reconciliation_alerts SET delivered_at = now()
    WHERE id = ${alertId} AND delivered_at IS NULL
    RETURNING id
  `;
  if (claimed.length === 0) {
    return null;
  }

  const users = [...new Set(payload.affected.map(a => String(a.user_id)))];
  const txHashes = payload.affected
    .map(a => a.tx_hash)
    .filter((h): h is string => typeof h === "string");
  const outcome = await sendOperationalAlert({
    category: "tip_reconciliation",
    event: "tip_reconciliation_anomaly",
    severity: evaluation.severity,
    title: "Tip reconciliation corrected more than expected",
    dedupKey: `tip_reconciliation:${signature}`,
    cooldownSeconds: Math.round(t.cooldownHours * 3600),
    details: {
      run_id: run.runId,
      run_started_at: run.startedAt,
      run_status: run.status,
      reasons: evaluation.reasons
        .map(
          r => `${r.code} (observed ${r.observed}, threshold ${r.threshold})`
        )
        .join("; "),
      corrections_count: run.correctionsCount,
      correction_amount_xlm: fromStroops(run.correctionStroops),
      largest_correction_xlm: fromStroops(run.largestStroops),
      decreased_totals: run.decreasedCount,
      tips_inserted: run.tipsInserted,
      cold_start: evaluation.coldStart,
      baseline_runs: evaluation.baseline?.runs ?? 0,
      baseline_count_median: evaluation.baseline?.countMedian ?? null,
      baseline_magnitude_median_xlm:
        evaluation.baseline?.magnitudeMedianXlm ?? null,
      affected_users: users.slice(0, MAX_AFFECTED_IN_MESSAGE).join(", "),
      affected_tx_hashes: txHashes.slice(0, MAX_AFFECTED_IN_MESSAGE).join(", "),
      investigate: "GET /api/admin/reconciliation/tips",
    },
  });
  await sql`
    UPDATE reconciliation_alerts SET delivery = ${outcome}
    WHERE id = ${alertId}
  `;
  return outcome;
}

/**
 * Evaluate every finished run that has not been evaluated yet (the current
 * one and any left behind by a crash). Failures are logged and retried next
 * time; they never break the reconciliation job.
 */
export async function evaluatePendingRuns(
  thresholds: AlertThresholds = loadThresholds()
): Promise<{ evaluated: number; failed: number }> {
  const { rows } = await sql`
    SELECT run_id FROM job_runs
    WHERE job_name = ${TIP_RECONCILIATION_JOB}
      AND run_id IS NOT NULL
      AND status <> 'skipped'
      AND alert_evaluated_at IS NULL
      AND started_at > now() - interval '7 days'
    ORDER BY started_at
    LIMIT 50
  `;
  let evaluated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await evaluateTipReconciliationRun(String(row.run_id), thresholds);
      evaluated++;
    } catch (err) {
      failed++;
      logger.error("tip_reconciliation_alert_evaluation_failed", {
        runId: String(row.run_id),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { evaluated, failed };
}
