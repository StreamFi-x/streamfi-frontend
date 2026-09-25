/**
 * Anomaly alerting for tip reconciliation runs (#1405).
 * See docs/data-integrity.md for the model and its tuning.
 *
 * Inputs come only from tip_reconciliation_corrections (what the job actually
 * did) joined to job_runs, so this layer cannot disagree with reconciliation.
 *
 * Model — per run, compared with up to BASELINE_RUNS previous runs:
 *   count      corrections applied
 *   magnitude  sum |delta| of applied corrections (exact, in stroops)
 * For each metric: threshold = max(absolute floor,
 *                                  median + K × 1.4826 × MAD,
 *                                  RATIO × median)
 * Median/MAD are robust to the occasional spike, so one incident does not
 * inflate the baseline for the next. Independently of the baseline:
 *   - any single correction >= SINGLE_CORRECTION_XLM          (critical)
 *   - any NOT_ON_LEDGER / CREATOR_MISMATCH flag               (critical;
 *     a stored tip the ledger does not show is never timing drift)
 *   - a failed or abandoned run                                (critical)
 * Cold start (< MIN_BASELINE_RUNS prior runs): only the absolute cold-start
 * thresholds and the baseline-independent rules above apply.
 */
import { createHash } from "crypto";
import { sql } from "@vercel/postgres";
import { fromStroops, toStroops } from "@/lib/stellar/amounts";
import { errorMessage } from "@/lib/jobs/runs";
import { sendOpsAlertEmail } from "@/utils/send-email";

export const TIP_RECONCILIATION_JOB = "tip-reconciliation";
const ALERT_SOURCE = "tip-reconciliation";
const MAX_DELIVERY_ATTEMPTS = 5;
const MAX_AFFECTED_IN_PAYLOAD = 50;

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
  finishedAt: string | null;
  correctionsCount: number;
  correctionStroops: bigint;
  largestStroops: bigint;
  flaggedCount: number;
  byKind: Record<string, number>;
}

export type ReasonCode =
  | "RUN_FAILED"
  | "LEDGER_MISMATCH"
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
  "LEDGER_MISMATCH",
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

  if (run.status === "failed" || run.status === "abandoned") {
    reasons.push({ code: "RUN_FAILED", observed: run.status, threshold: "-" });
  }
  if (run.flaggedCount > 0) {
    reasons.push({
      code: "LEDGER_MISMATCH",
      observed: String(run.flaggedCount),
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
 * Two alerts with the same signature describe the same situation, so a repeat
 * within the cooldown is recorded as suppressed instead of sent. The signature
 * includes the order of magnitude of the correction amount (an escalation
 * re-alerts) and the exact set of flagged transactions (a new mismatch
 * re-alerts; the same unresolved one does not page every hour).
 */
export function alertSignature(
  evaluation: Evaluation,
  run: RunAggregate,
  flaggedTxHashes: string[]
): string {
  const codes = evaluation.reasons.map(r => r.code).sort();
  const parts = [codes.join("+")];
  if (
    codes.some(c => c.includes("MAGNITUDE") || c === "LARGE_SINGLE_CORRECTION")
  ) {
    const xlm = fromStroops(run.correctionStroops).split(".")[0];
    parts.push(`mag${xlm.length}`);
  }
  if (flaggedTxHashes.length > 0) {
    parts.push(
      createHash("sha256")
        .update([...flaggedTxHashes].sort().join(","))
        .digest("hex")
        .slice(0, 16)
    );
  }
  return parts.join("|");
}

// ── persistence ──────────────────────────────────────────────────────────────

function toAggregate(row: Record<string, unknown>): RunAggregate {
  return {
    runId: String(row.id),
    status: String(row.status),
    startedAt: new Date(String(row.started_at)).toISOString(),
    finishedAt: row.finished_at
      ? new Date(String(row.finished_at)).toISOString()
      : null,
    correctionsCount: Number(row.corrections_count),
    correctionStroops: toStroops(String(row.correction_amount)),
    largestStroops: toStroops(String(row.largest_correction)),
    flaggedCount: Number(row.flagged_count),
    byKind: (row.by_kind as Record<string, number>) ?? {},
  };
}

async function loadHistory(
  before: string,
  limit: number
): Promise<RunAggregate[]> {
  const { rows } = await sql`
    SELECT r.id, r.status, r.started_at, r.finished_at,
           count(c.id) FILTER (WHERE c.applied) AS corrections_count,
           COALESCE(sum(c.delta_abs) FILTER (WHERE c.applied), 0)::text AS correction_amount,
           COALESCE(max(c.delta_abs) FILTER (WHERE c.applied), 0)::text AS largest_correction,
           count(c.id) FILTER (WHERE NOT c.applied) AS flagged_count,
           '{}'::jsonb AS by_kind
    FROM job_runs r
    LEFT JOIN tip_reconciliation_corrections c ON c.run_id = r.id
    WHERE r.job_name = ${TIP_RECONCILIATION_JOB}
      AND r.status IN ('completed', 'partial')
      AND r.started_at < ${before}::timestamptz
    GROUP BY r.id
    ORDER BY r.started_at DESC
    LIMIT ${limit}
  `;
  return rows.map(toAggregate);
}

async function loadRun(runId: string): Promise<RunAggregate | null> {
  const { rows } = await sql`
    SELECT r.id, r.status, r.started_at, r.finished_at,
           count(c.id) FILTER (WHERE c.applied) AS corrections_count,
           COALESCE(sum(c.delta_abs) FILTER (WHERE c.applied), 0)::text AS correction_amount,
           COALESCE(max(c.delta_abs) FILTER (WHERE c.applied), 0)::text AS largest_correction,
           count(c.id) FILTER (WHERE NOT c.applied) AS flagged_count,
           COALESCE(
             (SELECT jsonb_object_agg(kind, n) FROM (
                SELECT kind, count(*) AS n FROM tip_reconciliation_corrections
                WHERE run_id = r.id GROUP BY kind) k),
             '{}'::jsonb) AS by_kind
    FROM job_runs r
    LEFT JOIN tip_reconciliation_corrections c ON c.run_id = r.id
    WHERE r.id = ${runId}
    GROUP BY r.id
  `;
  return rows[0] ? toAggregate(rows[0]) : null;
}

async function loadAffected(runId: string) {
  const { rows } = await sql`
    SELECT kind, applied, tx_hash, creator_id, tip_transaction_id,
           amount_before::text, amount_after::text, delta_abs::text
    FROM tip_reconciliation_corrections
    WHERE run_id = ${runId}
    ORDER BY applied ASC, delta_abs DESC
    LIMIT ${MAX_AFFECTED_IN_PAYLOAD}
  `;
  return rows;
}

/**
 * Evaluate one finished run and store an alert if it is abnormal. Idempotent:
 * the alert fingerprint is the run id, and the run is marked evaluated.
 */
export async function evaluateTipReconciliationRun(
  runId: string,
  thresholds: AlertThresholds = loadThresholds()
): Promise<{ abnormal: boolean; alertId: string | null; status?: string }> {
  const run = await loadRun(runId);
  if (!run) {
    throw new Error(`run ${runId} not found`);
  }
  const history = await loadHistory(run.startedAt, thresholds.baselineRuns);
  const evaluation = evaluateRun(run, history, thresholds);

  let alertId: string | null = null;
  let alertStatus: string | undefined;
  if (evaluation.abnormal) {
    const affected = await loadAffected(runId);
    const flagged = affected
      .filter(a => a.applied === false)
      .map(a => String(a.tx_hash));
    const signature = alertSignature(evaluation, run, flagged);
    const payload = {
      source: ALERT_SOURCE,
      severity: evaluation.severity,
      run: {
        id: run.runId,
        status: run.status,
        started_at: run.startedAt,
        finished_at: run.finishedAt,
      },
      observed: {
        corrections_count: run.correctionsCount,
        correction_amount_xlm: fromStroops(run.correctionStroops),
        largest_correction_xlm: fromStroops(run.largestStroops),
        flagged_count: run.flaggedCount,
        by_kind: run.byKind,
      },
      reasons: evaluation.reasons,
      cold_start: evaluation.coldStart,
      baseline: evaluation.baseline,
      affected_total: run.correctionsCount + run.flaggedCount,
      // Transaction hashes are public on-chain data; creators are identified
      // by id only (no usernames, wallets or emails).
      affected: affected.map(a => ({
        kind: a.kind,
        applied: a.applied,
        tx_hash: a.tx_hash,
        creator_id: a.creator_id,
        tip_transaction_id: a.tip_transaction_id,
        amount_before_xlm: a.amount_before,
        amount_after_xlm: a.amount_after,
        delta_xlm: a.delta_abs,
      })),
    };

    const { rows } = await sql`
      WITH recent AS (
        SELECT 1 FROM reconciliation_alerts
        WHERE source = ${ALERT_SOURCE}
          AND signature = ${signature}
          AND status = 'delivered'
          AND delivered_at > now() - make_interval(secs => ${Math.round(thresholds.cooldownHours * 3600)})
        LIMIT 1
      )
      INSERT INTO reconciliation_alerts (fingerprint, source, run_id, severity, signature, status, payload)
      VALUES (
        ${`${ALERT_SOURCE}:run:${runId}`}, ${ALERT_SOURCE}, ${runId},
        ${evaluation.severity}, ${signature},
        CASE WHEN EXISTS (SELECT 1 FROM recent) THEN 'suppressed' ELSE 'pending' END,
        ${JSON.stringify(payload)}::jsonb
      )
      ON CONFLICT (fingerprint) DO NOTHING
      RETURNING id, status
    `;
    alertId = rows[0]?.id ?? null;
    alertStatus = rows[0]?.status;
  }

  await sql`
    UPDATE job_runs SET alert_evaluated_at = now()
    WHERE id = ${runId} AND alert_evaluated_at IS NULL
  `;

  console.log(
    JSON.stringify({
      job: "tip-reconciliation-alerts",
      runId,
      abnormal: evaluation.abnormal,
      severity: evaluation.abnormal ? evaluation.severity : null,
      reasons: evaluation.reasons.map(r => r.code),
      coldStart: evaluation.coldStart,
      alertId,
      alertStatus,
    })
  );
  return { abnormal: evaluation.abnormal, alertId, status: alertStatus };
}

/**
 * Evaluate every finished run that has not been evaluated yet (the current one
 * and any left behind by a crash). Failures are logged and retried next time.
 */
export async function evaluatePendingRuns(): Promise<{
  evaluated: number;
  failed: number;
}> {
  const { rows } = await sql`
    SELECT id FROM job_runs
    WHERE job_name = ${TIP_RECONCILIATION_JOB}
      AND status <> 'running'
      AND alert_evaluated_at IS NULL
      AND started_at > now() - interval '7 days'
    ORDER BY started_at
    LIMIT 50
  `;
  let evaluated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await evaluateTipReconciliationRun(String(row.id));
      evaluated++;
    } catch (err) {
      failed++;
      console.error(
        `[tip-reconciliation-alerts] evaluation of run ${row.id} failed: ${errorMessage(err)}`
      );
    }
  }
  return { evaluated, failed };
}

// ── delivery ─────────────────────────────────────────────────────────────────

function alertRecipients(): string[] {
  return (process.env.RECONCILIATION_ALERT_EMAILS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export function formatAlertEmail(payload: Record<string, unknown>): {
  subject: string;
  text: string;
} {
  const run = payload.run as { id: string };
  const reasons = (payload.reasons as AlertReason[])
    .map(r => `  - ${r.code}: observed ${r.observed}, threshold ${r.threshold}`)
    .join("\n");
  return {
    subject: `[StreamFi][${String(payload.severity).toUpperCase()}] Tip reconciliation anomaly (run ${run.id})`,
    text: [
      "Tip reconciliation produced corrections outside the expected range.",
      "",
      "Reasons:",
      reasons,
      "",
      "Full details (run, observed metrics, baseline, affected transactions):",
      JSON.stringify(payload, null, 2),
      "",
      "Investigate: GET /api/admin/reconciliation/tips",
    ].join("\n"),
  };
}

/**
 * Send pending alerts. Each alert is claimed with a conditional update so two
 * invocations never send the same alert; a failure is recorded (never marked
 * delivered) and retried up to MAX_DELIVERY_ATTEMPTS times.
 */
export async function deliverPendingAlerts(): Promise<{
  delivered: number;
  failed: number;
}> {
  const { rows: claimed } = await sql`
    UPDATE reconciliation_alerts
    SET status = 'sending',
        claimed_until = now() + interval '5 minutes',
        attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM reconciliation_alerts
      WHERE (status IN ('pending', 'failed') AND attempts < ${MAX_DELIVERY_ATTEMPTS})
         OR (status = 'sending' AND claimed_until < now())
      ORDER BY created_at
      LIMIT 20
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, payload, attempts
  `;

  let delivered = 0;
  let failed = 0;
  const recipients = alertRecipients();
  for (const alert of claimed) {
    try {
      if (recipients.length === 0) {
        throw new Error("RECONCILIATION_ALERT_EMAILS is not configured");
      }
      const { subject, text } = formatAlertEmail(alert.payload);
      await sendOpsAlertEmail(recipients, subject, text);
      await sql`
        UPDATE reconciliation_alerts
        SET status = 'delivered', delivered_at = now(), last_error = NULL, claimed_until = NULL
        WHERE id = ${alert.id}
      `;
      delivered++;
    } catch (err) {
      failed++;
      const message = errorMessage(err);
      console.error(
        JSON.stringify({
          job: "tip-reconciliation-alerts",
          event: "delivery_failed",
          alertId: alert.id,
          attempt: alert.attempts,
          final: alert.attempts >= MAX_DELIVERY_ATTEMPTS,
          error: message,
        })
      );
      await sql`
        UPDATE reconciliation_alerts
        SET status = 'failed', last_error = ${message}, claimed_until = NULL
        WHERE id = ${alert.id}
      `;
    }
  }
  return { delivered, failed };
}
