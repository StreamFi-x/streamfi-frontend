/**
 * #1400: derives users.total_tips_received / total_tips_count / last_tip_at
 * from the Stellar ledger. Shared by the manual refresh endpoint
 * (app/api/tips/refresh-total) and the scheduled reconciliation job, so both
 * use the same definition of a tip (lib/stellar/horizon.ts
 * fetchPaymentsReceived: incoming native XLM `payment` /
 * `path_payment_strict_receive` operations).
 *
 * Totals are always a full recalculation from the complete payment history,
 * never an increment. Writes are guarded by users.tip_totals_version so a
 * slower reconciliation can never overwrite a newer total.
 */
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";
import {
  mapWithConcurrency,
  sleep as defaultSleep,
} from "@/lib/jobs/concurrency";
import type { JobOutcome } from "@/lib/jobs/scheduled-job";
import { fetchPaymentsReceived } from "@/lib/stellar/horizon";
import { logger } from "@/lib/tracing/logger";

const STROOPS_PER_XLM = BigInt(10_000_000);

export interface LedgerTip {
  sender: string;
  amount: string;
  txHash: string;
  timestamp: string;
}

type FetchPayments = (params: {
  publicKey: string;
  limit?: number;
  cursor?: string;
}) => Promise<{ tips: LedgerTip[]; nextCursor: string | undefined }>;

export interface HorizonPolicy {
  pageSize: number;
  /** A history longer than this is rejected rather than partially summed. */
  maxPages: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_HORIZON_POLICY: HorizonPolicy = {
  pageSize: 200,
  maxPages: 100,
  maxRetries: 4,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
};

export interface LedgerFetchDeps {
  fetchPayments?: FetchPayments;
  policy?: Partial<HorizonPolicy>;
  sleep?: (ms: number) => Promise<void>;
}

export interface LedgerTipTotals {
  totalStroops: bigint;
  totalReceived: string;
  totalCount: number;
  lastTipAt: string | null;
  tips: LedgerTip[];
  requests: number;
  retries: number;
  rateLimited: number;
}

export class HorizonRateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HorizonRateLimitedError";
  }
}

export class LedgerHistoryTooLargeError extends Error {
  constructor(pages: number) {
    super(
      `Payment history exceeds ${pages} pages; refusing to write a partial total`
    );
    this.name = "LedgerHistoryTooLargeError";
  }
}

export function toStroops(amount: string | number | null | undefined): bigint {
  if (amount === null || amount === undefined || amount === "") {
    return BigInt(0);
  }
  const text = String(amount).trim();
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match) {
    throw new Error(`Invalid XLM amount "${text}"`);
  }
  const [, sign, whole, fraction = ""] = match;
  const stroops =
    BigInt(whole || "0") * STROOPS_PER_XLM +
    BigInt((fraction + "0000000").slice(0, 7));
  return sign === "-" ? -stroops : stroops;
}

export function fromStroops(stroops: bigint): string {
  const negative = stroops < BigInt(0);
  const abs = negative ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const fraction = (abs % STROOPS_PER_XLM).toString().padStart(7, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function httpStatusOf(error: unknown): number | undefined {
  const response = (error as { response?: { status?: unknown } })?.response;
  return typeof response?.status === "number" ? response.status : undefined;
}

function isRetryable(status: number | undefined): boolean {
  return status === undefined || status === 429 || status >= 500;
}

/**
 * Pages through the account's complete payment history. Transient Horizon
 * failures (429, 5xx, network) are retried with capped exponential backoff and
 * jitter; a history larger than maxPages fails instead of producing a partial
 * sum. An account Horizon does not know (404, unfunded) has no tips.
 */
export async function fetchLedgerTipTotals(
  publicKey: string,
  deps: LedgerFetchDeps = {}
): Promise<LedgerTipTotals> {
  const fetchPayments = deps.fetchPayments ?? fetchPaymentsReceived;
  const policy = { ...DEFAULT_HORIZON_POLICY, ...deps.policy };
  const wait = deps.sleep ?? defaultSleep;

  const tips: LedgerTip[] = [];
  let cursor: string | undefined;
  let requests = 0;
  let retries = 0;
  let rateLimited = 0;
  let pages = 0;

  for (;;) {
    if (pages >= policy.maxPages) {
      throw new LedgerHistoryTooLargeError(policy.maxPages);
    }

    let page: Awaited<ReturnType<FetchPayments>> | null = null;
    for (let attempt = 0; page === null; attempt++) {
      requests++;
      try {
        page = await fetchPayments({
          publicKey,
          limit: policy.pageSize,
          cursor,
        });
      } catch (error) {
        const status = httpStatusOf(error);
        if (status === 404 && pages === 0) {
          return {
            totalStroops: BigInt(0),
            totalReceived: fromStroops(BigInt(0)),
            totalCount: 0,
            lastTipAt: null,
            tips: [],
            requests,
            retries,
            rateLimited,
          };
        }
        if (status === 429) {
          rateLimited++;
        }
        if (!isRetryable(status) || attempt >= policy.maxRetries) {
          if (status === 429) {
            throw new HorizonRateLimitedError(
              `Horizon rate limited after ${attempt + 1} attempts`
            );
          }
          throw error;
        }
        retries++;
        const backoff = Math.min(
          policy.maxDelayMs,
          policy.baseDelayMs * 2 ** attempt
        );
        await wait(backoff / 2 + Math.random() * (backoff / 2));
      }
    }

    pages++;
    tips.push(...page.tips);
    if (!page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
  }

  let totalStroops = BigInt(0);
  let lastTipAt: string | null = null;
  for (const tip of tips) {
    totalStroops += toStroops(tip.amount);
    if (!lastTipAt || new Date(tip.timestamp) > new Date(lastTipAt)) {
      lastTipAt = tip.timestamp;
    }
  }

  return {
    totalStroops,
    totalReceived: fromStroops(totalStroops),
    totalCount: tips.length,
    lastTipAt,
    tips,
    requests,
    retries,
    rateLimited,
  };
}

const TIP_INSERT_CHUNK = 500;

/**
 * Records ledger tips in tip_transactions in batches. The ON CONFLICT target
 * repeats the partial unique index predicate; without it PostgreSQL cannot
 * match idx_tip_transactions_tx_hash_unique and rejects the statement.
 */
async function recordTipTransactions(
  executor: SqlExecutor,
  creatorId: string,
  tips: LedgerTip[],
  xlmUsdPrice: number | null
): Promise<void> {
  for (let i = 0; i < tips.length; i += TIP_INSERT_CHUNK) {
    const chunk = tips.slice(i, i + TIP_INSERT_CHUNK);
    await executor(
      `INSERT INTO tip_transactions
         (creator_id, supporter_id, amount_xlm, price_usd, tx_hash, memo, created_at)
       SELECT $1, supporter.id, t.amount, $2, t.tx_hash, 'StreamFi Tip', t.created_at
         FROM unnest($3::text[], $4::numeric[], $5::text[], $6::timestamptz[])
              AS t(sender, amount, tx_hash, created_at)
         LEFT JOIN users supporter ON supporter.wallet = t.sender
       ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO NOTHING`,
      [
        creatorId,
        xlmUsdPrice,
        chunk.map(t => t.sender),
        chunk.map(t => t.amount),
        chunk.map(t => t.txHash),
        chunk.map(t => t.timestamp),
      ]
    );
  }
}

export interface ReconcileUserOptions {
  executor?: SqlExecutor;
  ledger?: LedgerFetchDeps;
  getXlmUsdPrice?: () => Promise<number>;
  /** Re-run when a concurrent writer changed the totals (manual refresh). */
  maxAttempts?: number;
}

export interface ReconcileUserResult {
  status: "updated" | "stale" | "not_found";
  previousTotal: string | null;
  totals: LedgerTipTotals | null;
  /** New total minus previous total, in XLM. */
  discrepancy: string | null;
  countChanged: boolean;
}

/**
 * Recalculates one user's totals from the ledger and writes them only if no
 * other writer (manual refresh, scheduled job, payment webhook) changed the
 * totals since this reconciliation started.
 */
export async function reconcileUserTipTotals(
  userId: string,
  publicKey: string,
  options: ReconcileUserOptions = {}
): Promise<ReconcileUserResult> {
  const executor = options.executor ?? defaultExecutor;
  const maxAttempts = options.maxAttempts ?? 1;
  let lastPrevious: string | null = null;
  let lastTotals: LedgerTipTotals | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { rows } = await executor(
      `SELECT tip_totals_version, total_tips_received, total_tips_count
         FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows[0]) {
      return {
        status: "not_found",
        previousTotal: null,
        totals: null,
        discrepancy: null,
        countChanged: false,
      };
    }
    const version = String(rows[0].tip_totals_version);
    const previousStroops = toStroops(rows[0].total_tips_received);
    const previousCount = Number(rows[0].total_tips_count ?? 0);
    lastPrevious = fromStroops(previousStroops);

    const totals = await fetchLedgerTipTotals(publicKey, options.ledger);
    lastTotals = totals;

    if (totals.tips.length > 0) {
      const price = options.getXlmUsdPrice
        ? await options.getXlmUsdPrice()
        : null;
      await recordTipTransactions(executor, userId, totals.tips, price);
    }

    const updated = await executor(
      `UPDATE users
          SET total_tips_received = $2,
              total_tips_count = $3,
              last_tip_at = $4,
              tip_totals_version = tip_totals_version + 1,
              tips_reconciled_at = NOW(),
              updated_at = NOW()
        WHERE id = $1 AND tip_totals_version = $5
      RETURNING id`,
      [
        userId,
        totals.totalReceived,
        totals.totalCount,
        totals.lastTipAt,
        version,
      ]
    );

    if (updated.rows.length > 0) {
      return {
        status: "updated",
        previousTotal: lastPrevious,
        totals,
        discrepancy: fromStroops(totals.totalStroops - previousStroops),
        countChanged: totals.totalCount !== previousCount,
      };
    }
  }

  return {
    status: "stale",
    previousTotal: lastPrevious,
    totals: lastTotals,
    discrepancy: null,
    countChanged: false,
  };
}

export interface TipReconciliationJobOptions {
  executor?: SqlExecutor;
  ledger?: LedgerFetchDeps;
  getXlmUsdPrice?: () => Promise<number>;
  onTotalsChanged?: (userId: string) => Promise<void>;
  batchSize?: number;
  /** A user is due once their last successful reconciliation is this old. */
  staleAfterMinutes?: number;
  /** Minimum gap between attempts for a user whose reconciliation failed. */
  retryAfterMinutes?: number;
  concurrency?: number;
  /** Stop starting new users after this long, leaving time to finish. */
  timeBudgetMs?: number;
  /** Absolute change (XLM) reported as a large discrepancy. */
  discrepancyAlertXlm?: number;
  now?: () => number;
}

export interface TipReconciliationDetail {
  userId: string;
  outcome: "corrected" | "unchanged" | "stale" | "failed" | "deferred";
  discrepancy?: string;
  error?: string;
}

interface DueUser {
  id: string;
  wallet: string;
  tips_reconciled_at: string | null;
  prev_attempted_at: string | null;
}

/**
 * Scheduled job body: claims a bounded batch of the stalest users (never
 * reconciled first, then oldest reconciliation) and reconciles them with
 * bounded concurrency. The claim uses FOR UPDATE SKIP LOCKED so overlapping
 * runs never pick the same users, and stamps tips_reconcile_attempted_at so a
 * user that keeps failing backs off instead of blocking the queue.
 */
export async function reconcileStaleTipTotals(
  options: TipReconciliationJobOptions = {}
): Promise<JobOutcome<TipReconciliationDetail[]>> {
  const executor = options.executor ?? defaultExecutor;
  const now = options.now ?? Date.now;
  const started = now();
  const batchSize = options.batchSize ?? 25;
  const budget = options.timeBudgetMs ?? 45_000;
  const alertThreshold = toStroops(String(options.discrepancyAlertXlm ?? 100));

  const metrics = {
    selected: 0,
    reconciled: 0,
    corrected: 0,
    unchanged: 0,
    stale_skipped: 0,
    failed: 0,
    deferred: 0,
    ledger_requests: 0,
    retries: 0,
    rate_limited: 0,
    large_discrepancies: 0,
  };
  const details: TipReconciliationDetail[] = [];
  const largeDiscrepancyUsers: string[] = [];

  const { rows } = await executor(
    `WITH due AS (
       SELECT id, tips_reconcile_attempted_at AS prev_attempted_at
         FROM users
        WHERE wallet ~ '^G[A-Z2-7]{55}$'
          AND (tips_reconciled_at IS NULL
               OR tips_reconciled_at < NOW() - make_interval(mins => $1::int))
          AND (tips_reconcile_attempted_at IS NULL
               OR tips_reconcile_attempted_at < NOW() - make_interval(mins => $2::int))
        ORDER BY tips_reconciled_at ASC NULLS FIRST, id
        LIMIT $3
        FOR UPDATE SKIP LOCKED
     )
     UPDATE users u
        SET tips_reconcile_attempted_at = NOW()
       FROM due
      WHERE u.id = due.id
     RETURNING u.id, u.wallet, u.tips_reconciled_at, due.prev_attempted_at`,
    [
      options.staleAfterMinutes ?? 360,
      options.retryAfterMinutes ?? 30,
      batchSize,
    ]
  );

  const users = (rows as DueUser[]).sort((a, b) => {
    if (!a.tips_reconciled_at) {
      return b.tips_reconciled_at ? -1 : 0;
    }
    if (!b.tips_reconciled_at) {
      return 1;
    }
    return (
      new Date(a.tips_reconciled_at).getTime() -
      new Date(b.tips_reconciled_at).getTime()
    );
  });
  metrics.selected = users.length;

  let rateLimitCircuitOpen = false;
  const deferred: DueUser[] = [];

  await mapWithConcurrency(users, options.concurrency ?? 2, async user => {
    if (rateLimitCircuitOpen || now() - started > budget) {
      deferred.push(user);
      details.push({ userId: user.id, outcome: "deferred" });
      return;
    }
    try {
      const result = await reconcileUserTipTotals(user.id, user.wallet, {
        executor,
        ledger: options.ledger,
        getXlmUsdPrice: options.getXlmUsdPrice,
      });
      if (result.totals) {
        metrics.ledger_requests += result.totals.requests;
        metrics.retries += result.totals.retries;
        metrics.rate_limited += result.totals.rateLimited;
      }
      if (result.status === "stale") {
        metrics.stale_skipped++;
        details.push({ userId: user.id, outcome: "stale" });
        return;
      }
      if (result.status === "not_found") {
        return;
      }
      metrics.reconciled++;
      const diff = toStroops(result.discrepancy);
      if (diff === BigInt(0) && !result.countChanged) {
        metrics.unchanged++;
        details.push({ userId: user.id, outcome: "unchanged" });
        return;
      }
      metrics.corrected++;
      details.push({
        userId: user.id,
        outcome: "corrected",
        discrepancy: result.discrepancy ?? undefined,
      });
      const magnitude = diff < BigInt(0) ? -diff : diff;
      if (magnitude >= alertThreshold) {
        metrics.large_discrepancies++;
        largeDiscrepancyUsers.push(user.id);
        logger.warn("Large tip total discrepancy corrected", {
          operation: "reconcileStaleTipTotals",
          userId: user.id,
          previousTotal: result.previousTotal,
          newTotal: result.totals?.totalReceived,
        });
      }
      if (result.countChanged && options.onTotalsChanged) {
        await options.onTotalsChanged(user.id).catch(error =>
          logger.warn("Post-reconciliation hook failed", {
            userId: user.id,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          })
        );
      }
    } catch (error) {
      metrics.failed++;
      if (error instanceof HorizonRateLimitedError) {
        metrics.rate_limited++;
        rateLimitCircuitOpen = true;
      }
      const message = error instanceof Error ? error.message : String(error);
      details.push({ userId: user.id, outcome: "failed", error: message });
      logger.error("Tip reconciliation failed for user", {
        operation: "reconcileStaleTipTotals",
        userId: user.id,
        errorMessage: message,
      });
    }
  });

  // Deferred users were never attempted: give back their place in the queue.
  for (const user of deferred) {
    await executor(
      `UPDATE users SET tips_reconcile_attempted_at = $2 WHERE id = $1`,
      [user.id, user.prev_attempted_at]
    );
  }
  metrics.deferred = deferred.length;

  const alerts: string[] = [];
  if (metrics.large_discrepancies > 0) {
    alerts.push(
      `${metrics.large_discrepancies} user(s) had tip totals corrected by at least ` +
        `${fromStroops(alertThreshold)} XLM (e.g. ${largeDiscrepancyUsers.slice(0, 5).join(", ")})`
    );
  }
  if (rateLimitCircuitOpen) {
    alerts.push(
      `Horizon rate limiting stopped the run early; ${metrics.deferred} user(s) deferred`
    );
  }

  const attempted = metrics.selected - metrics.deferred;
  const status =
    attempted > 0 && metrics.failed >= attempted
      ? "failed"
      : metrics.failed > 0 || metrics.deferred > 0
        ? "partial"
        : "succeeded";

  return { status, metrics, alerts, detail: details };
}
