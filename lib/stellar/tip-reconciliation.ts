/**
 * Derives users.total_tips_received / total_tips_count / last_tip_at from the
 * Stellar ledger (#1400), resumably and with bounded work per call (#1418).
 * Shared by the manual refresh endpoint (app/api/tips/refresh-total), the
 * per-creator continuation job and the scheduled reconciliation job (see
 * lib/jobs/definitions/tip-reconciliation.ts), so all use the same definition
 * of a tip (lib/stellar/horizon.ts fetchPaymentsReceived: incoming native XLM
 * `payment` / `path_payment_strict_receive` operations).
 *
 * The account's payment history is walked oldest first, one page at a time.
 * After each page the tips are recorded (idempotently, by tx hash) and the
 * creator's checkpoint (tip_reconciliation_checkpoints) is advanced with a
 * compare-and-set on its cursor, together with the running totals. So:
 *
 * - An interruption (Horizon slow or down, circuit open, time budget used up,
 *   crash) leaves every processed page fully recorded and nothing else; the
 *   next call resumes at the cursor. Nothing is ever half-applied.
 * - Two workers on the same creator cannot both add a page: the loser's
 *   compare-and-set matches no row and it stops (`superseded`).
 * - users.total_tips_* is written only when the walk has reached the end of
 *   the history, from the checkpoint's totals, never from a partial walk.
 *   The write is guarded by users.tip_totals_version (read before the final,
 *   empty page), so a payment the webhook credited meanwhile is never lost:
 *   the walk just reads one more page.
 * - The ledger is append-only, so the totals up to the cursor stay correct.
 *   Once caught up, a later reconciliation only reads newer payments.
 *
 * Transient Horizon failures are not retried inside the call (that is what
 * made a single request unbounded); the caller retries later, the scheduled
 * and continuation jobs through QStash's backoff.
 */
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";
import { mapWithConcurrency } from "@/lib/jobs/concurrency";
import type { JobOutcome } from "@/lib/jobs/scheduled-job";
import {
  CircuitOpenError,
  httpStatusOf,
} from "@/lib/resilience/circuit-breaker";
import { fetchPaymentsReceived } from "@/lib/stellar/horizon";
import { logger } from "@/lib/tracing/logger";
import { invalidateUserCaches } from "@/lib/cache/invalidation";

const STROOPS_PER_XLM = BigInt(10_000_000);

/**
 * Bump when the definition of a tip changes (the filter in
 * fetchPaymentsReceived): every checkpoint then restarts from the beginning.
 */
export const TIP_DEFINITION_VERSION = 1;

export interface LedgerTip {
  sender: string;
  amount: string;
  txHash: string;
  timestamp: string;
}

export interface LedgerPage {
  tips: LedgerTip[];
  /** Paging token of the page's last record; undefined when the page is empty. */
  nextCursor: string | undefined;
}

export type FetchPayments = (params: {
  publicKey: string;
  limit?: number;
  cursor?: string;
  order?: "asc" | "desc";
}) => Promise<LedgerPage>;

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

const TIP_INSERT_CHUNK = 500;

/**
 * Records ledger tips in tip_transactions in batches. The ON CONFLICT target
 * repeats the partial unique index predicate; without it PostgreSQL cannot
 * match idx_tip_transactions_tx_hash_unique and rejects the statement.
 *
 * When `runId` is set (the scheduled job), every tip that was actually
 * missing is recorded as a TIP_INSERTED correction in the same statement, so
 * the alerting layer (#1405) sees exactly what the job changed.
 */
async function recordTipTransactions(
  executor: SqlExecutor,
  creatorId: string,
  tips: LedgerTip[],
  xlmUsdPrice: number | null,
  runId: string | null
): Promise<void> {
  for (let i = 0; i < tips.length; i += TIP_INSERT_CHUNK) {
    const chunk = tips.slice(i, i + TIP_INSERT_CHUNK);
    await executor(
      `WITH ins AS (
         INSERT INTO tip_transactions
           (creator_id, supporter_id, amount_xlm, price_usd, tx_hash, memo, created_at)
         SELECT $1, supporter.id, t.amount, $2, t.tx_hash, 'StreamFi Tip', t.created_at
           FROM unnest($3::text[], $4::numeric[], $5::text[], $6::timestamptz[])
                AS t(sender, amount, tx_hash, created_at)
           -- tombstone-aware: financial records keep their supporter link
           LEFT JOIN users supporter ON supporter.wallet = t.sender
         ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO NOTHING
         RETURNING creator_id, tx_hash, amount_xlm
       )
       INSERT INTO tip_reconciliation_corrections
         (run_id, kind, user_id, tx_hash, amount_after, delta)
       SELECT $7::uuid, 'TIP_INSERTED', creator_id, tx_hash, amount_xlm, amount_xlm
         FROM ins
        WHERE $7::uuid IS NOT NULL
       ON CONFLICT DO NOTHING`,
      [
        creatorId,
        xlmUsdPrice,
        chunk.map(t => t.sender),
        chunk.map(t => t.amount),
        chunk.map(t => t.txHash),
        chunk.map(t => t.timestamp),
        runId,
      ]
    );
  }
}

interface Checkpoint {
  cursor: string | null;
  totalStroops: bigint;
  tipCount: number;
  lastTipAt: string | null;
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

function checkpointFromRow(row: Record<string, unknown>): Checkpoint {
  return {
    cursor: (row.cursor as string | null) ?? null,
    totalStroops: BigInt(String(row.total_stroops ?? "0")),
    tipCount: Number(row.tip_count ?? 0),
    lastTipAt: toIso(row.last_tip_at),
  };
}

/**
 * Loads the creator's checkpoint, starting it (or starting it over when the
 * wallet or the tip definition changed).
 */
async function loadCheckpoint(
  executor: SqlExecutor,
  userId: string,
  publicKey: string
): Promise<Checkpoint> {
  await executor(
    `INSERT INTO tip_reconciliation_checkpoints (user_id, public_key, definition_version)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET public_key = EXCLUDED.public_key,
           definition_version = EXCLUDED.definition_version,
           cursor = NULL,
           total_stroops = 0,
           tip_count = 0,
           last_tip_at = NULL,
           pages = 0,
           started_at = NOW(),
           updated_at = NOW(),
           caught_up_at = NULL
     WHERE tip_reconciliation_checkpoints.public_key <> EXCLUDED.public_key
        OR tip_reconciliation_checkpoints.definition_version <> EXCLUDED.definition_version`,
    [userId, publicKey, TIP_DEFINITION_VERSION]
  );
  const { rows } = await executor(
    `SELECT cursor, total_stroops, tip_count, last_tip_at
       FROM tip_reconciliation_checkpoints WHERE user_id = $1`,
    [userId]
  );
  return checkpointFromRow(rows[0] ?? {});
}

export interface TipTotals {
  totalStroops: bigint;
  totalReceived: string;
  totalCount: number;
  lastTipAt: string | null;
}

function totalsOf(checkpoint: Checkpoint): TipTotals {
  return {
    totalStroops: checkpoint.totalStroops,
    totalReceived: fromStroops(checkpoint.totalStroops),
    totalCount: checkpoint.tipCount,
    lastTipAt: checkpoint.lastTipAt,
  };
}

export type ReconcileStatus =
  /** Reached the end of the history and wrote the totals. */
  | "complete"
  /** Page or time budget used up; resume later from the checkpoint. */
  | "in_progress"
  /** Horizon failed or the circuit is open; resume later. */
  | "interrupted"
  /** Another worker advanced the same checkpoint concurrently. */
  | "superseded"
  /** Other writers kept changing the totals; nothing written this time. */
  | "stale"
  | "not_found";

export interface ReconcileOptions {
  executor?: SqlExecutor;
  fetchPayments?: FetchPayments;
  getXlmUsdPrice?: () => Promise<number>;
  pageSize?: number;
  /** Pages this call may read. */
  maxPages?: number;
  /** Stop starting new pages after this long, ms. */
  timeBudgetMs?: number;
  /** Final writes lost to a concurrent writer before giving up. */
  maxWriteAttempts?: number;
  /**
   * Scheduled-job run id (job_runs.run_id). When set, every change is also
   * recorded in tip_reconciliation_corrections for anomaly alerting (#1405).
   */
  runId?: string;
  now?: () => number;
}

export interface ReconcileResult {
  status: ReconcileStatus;
  /** Written totals when complete; the checkpoint's partial totals otherwise. */
  totals: TipTotals | null;
  previousTotal: string | null;
  /** New total minus previous total, in XLM (complete only). */
  discrepancy: string | null;
  countChanged: boolean;
  pages: number;
  requests: number;
  cursor: string | null;
  /** Why an interrupted call stopped. */
  error?: unknown;
}

export const DEFAULT_PAGE_SIZE = 200;

/**
 * Advances one creator's reconciliation by at most `maxPages` pages or
 * `timeBudgetMs`, whichever comes first. Safe to call repeatedly and
 * concurrently; see the module comment for the consistency guarantees.
 */
export async function reconcileUserTipTotals(
  userId: string,
  publicKey: string,
  options: ReconcileOptions = {}
): Promise<ReconcileResult> {
  const executor = options.executor ?? defaultExecutor;
  const fetchPayments = options.fetchPayments ?? fetchPaymentsReceived;
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeBudgetMs ?? 8_000);
  const maxPages = options.maxPages ?? 10;
  const maxWriteAttempts = options.maxWriteAttempts ?? 3;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

  let checkpoint: Checkpoint | null = null;
  let pages = 0;
  let requests = 0;
  let writeAttempts = 0;
  let price: number | null | undefined;

  const result = (
    status: ReconcileStatus,
    extra: Partial<ReconcileResult> = {}
  ): ReconcileResult => ({
    status,
    totals: checkpoint ? totalsOf(checkpoint) : null,
    previousTotal: null,
    discrepancy: null,
    countChanged: false,
    pages,
    requests,
    cursor: checkpoint?.cursor ?? null,
    ...extra,
  });

  const exists = await executor(`SELECT 1 FROM users WHERE id = $1`, [userId]);
  if (exists.rows.length === 0) {
    return result("not_found");
  }
  let current = await loadCheckpoint(executor, userId, publicKey);
  checkpoint = current;

  for (;;) {
    if (pages >= maxPages || now() >= deadline) {
      return result("in_progress");
    }

    // Read before the page: if this page turns out to be the end, the totals
    // are only written if no one changed them after this point.
    const { rows } = await executor(
      `SELECT tip_totals_version, total_tips_received, total_tips_count
         FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows[0]) {
      return result("not_found");
    }
    const version = String(rows[0].tip_totals_version);

    let page: LedgerPage;
    requests++;
    try {
      page = await fetchPayments({
        publicKey,
        limit: pageSize,
        cursor: current.cursor ?? undefined,
        order: "asc",
      });
    } catch (error) {
      if (httpStatusOf(error) === 404 && current.cursor === null) {
        // Horizon does not know the account (never funded): no tips.
        page = { tips: [], nextCursor: undefined };
      } else {
        return result("interrupted", { error });
      }
    }

    if (page.nextCursor === undefined) {
      const totals = totalsOf(current);
      const previousStroops = toStroops(rows[0].total_tips_received);
      const previousTotal = fromStroops(previousStroops);
      const previousCount = Number(rows[0].total_tips_count ?? 0);
      // The correction row (#1405) is written by the same statement as the
      // totals, and only when the versioned update actually applied.
      const updated = await executor(
        `WITH upd AS (
           UPDATE users
              SET total_tips_received = $2,
                  total_tips_count = $3,
                  last_tip_at = $4,
                  tip_totals_version = tip_totals_version + 1,
                  tips_reconciled_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1 AND tip_totals_version = $5
          RETURNING id
         ),
         correction AS (
           INSERT INTO tip_reconciliation_corrections
             (run_id, kind, user_id, amount_before, amount_after, delta, count_before, count_after)
           SELECT $6::uuid, 'TOTALS_CORRECTED', id, $7::numeric, $2::numeric,
                  $2::numeric - $7::numeric, $8::int, $3::int
             FROM upd
            WHERE $6::uuid IS NOT NULL
              AND ($2::numeric <> $7::numeric OR $3::int <> $8::int)
           ON CONFLICT DO NOTHING
         )
         SELECT id FROM upd`,
        [
          userId,
          totals.totalReceived,
          totals.totalCount,
          totals.lastTipAt,
          version,
          options.runId ?? null,
          previousTotal,
          previousCount,
        ]
      );
      if (updated.rows.length === 0) {
        if (++writeAttempts >= maxWriteAttempts) {
          return result("stale");
        }
        continue;
      }
      await executor(
        `UPDATE tip_reconciliation_checkpoints SET caught_up_at = NOW()
          WHERE user_id = $1 AND cursor IS NOT DISTINCT FROM $2`,
        [userId, current.cursor]
      );
      // Profile and tip-stats reads are cached (docs/caching-policy.md).
      await invalidateUserCaches({ id: userId, wallet: publicKey });
      return result("complete", {
        totals,
        previousTotal,
        discrepancy: fromStroops(totals.totalStroops - previousStroops),
        countChanged: totals.totalCount !== previousCount,
      });
    }

    let pageStroops = BigInt(0);
    let pageLastTipAt: string | null = null;
    for (const tip of page.tips) {
      pageStroops += toStroops(tip.amount);
      if (!pageLastTipAt || new Date(tip.timestamp) > new Date(pageLastTipAt)) {
        pageLastTipAt = tip.timestamp;
      }
    }
    if (page.tips.length > 0) {
      if (price === undefined) {
        price = options.getXlmUsdPrice
          ? await options.getXlmUsdPrice().catch(() => null)
          : null;
      }
      await recordTipTransactions(
        executor,
        userId,
        page.tips,
        price,
        options.runId ?? null
      );
    }

    const advanced = await executor(
      `UPDATE tip_reconciliation_checkpoints
          SET cursor = $2,
              total_stroops = total_stroops + $3::numeric,
              tip_count = tip_count + $4,
              last_tip_at = GREATEST(last_tip_at, $5::timestamptz),
              pages = pages + 1,
              updated_at = NOW()
        WHERE user_id = $1
          AND cursor IS NOT DISTINCT FROM $6
          AND public_key = $7
          AND definition_version = $8
      RETURNING cursor, total_stroops, tip_count, last_tip_at`,
      [
        userId,
        page.nextCursor,
        pageStroops.toString(),
        page.tips.length,
        pageLastTipAt,
        current.cursor,
        publicKey,
        TIP_DEFINITION_VERSION,
      ]
    );
    if (advanced.rows.length === 0) {
      return result("superseded");
    }
    current = checkpointFromRow(advanced.rows[0]);
    checkpoint = current;
    pages++;
  }
}

export interface TipReconciliationJobOptions {
  executor?: SqlExecutor;
  fetchPayments?: FetchPayments;
  getXlmUsdPrice?: () => Promise<number>;
  onTotalsChanged?: (userId: string) => Promise<void>;
  batchSize?: number;
  /** A user is due once their last successful reconciliation is this old. */
  staleAfterMinutes?: number;
  /** Minimum gap between attempts for a user whose reconciliation failed. */
  retryAfterMinutes?: number;
  concurrency?: number;
  /** Pages one user may read per run; a longer history continues next run. */
  maxPagesPerUser?: number;
  /** Stop starting new pages or users after this long, leaving time to finish. */
  timeBudgetMs?: number;
  /** Absolute change (XLM) reported as a large discrepancy. */
  discrepancyAlertXlm?: number;
  /** job_runs.run_id of this run; enables correction recording (#1405). */
  runId?: string;
  now?: () => number;
}

export interface TipReconciliationDetail {
  userId: string;
  outcome:
    | "corrected"
    | "unchanged"
    | "in_progress"
    | "stale"
    | "failed"
    | "deferred";
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
 * reconciled first, then oldest reconciliation) and advances each with
 * bounded concurrency and a shared time budget. The claim uses FOR UPDATE
 * SKIP LOCKED so overlapping runs never pick the same users, and stamps
 * tips_reconcile_attempted_at so a user that keeps failing backs off instead
 * of blocking the queue. Users whose history needs more pages than one run
 * allows, and users never started because Horizon's circuit opened or time
 * ran out, get their place in the queue back.
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
    in_progress: 0,
    stale_skipped: 0,
    failed: 0,
    deferred: 0,
    ledger_requests: 0,
    ledger_pages: 0,
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

  let circuitOpen = false;
  const requeue: DueUser[] = [];

  await mapWithConcurrency(users, options.concurrency ?? 2, async user => {
    const remaining = budget - (now() - started);
    if (circuitOpen || remaining <= 0) {
      requeue.push(user);
      metrics.deferred++;
      details.push({ userId: user.id, outcome: "deferred" });
      return;
    }
    try {
      const result = await reconcileUserTipTotals(user.id, user.wallet, {
        executor,
        fetchPayments: options.fetchPayments,
        getXlmUsdPrice: options.getXlmUsdPrice,
        maxPages: options.maxPagesPerUser ?? 20,
        timeBudgetMs: remaining,
        runId: options.runId,
        now,
      });
      metrics.ledger_requests += result.requests;
      metrics.ledger_pages += result.pages;

      switch (result.status) {
        case "not_found":
          return;
        case "in_progress":
          metrics.in_progress++;
          requeue.push(user);
          details.push({ userId: user.id, outcome: "in_progress" });
          return;
        case "stale":
        case "superseded":
          metrics.stale_skipped++;
          details.push({ userId: user.id, outcome: "stale" });
          return;
        case "interrupted":
          if (result.error instanceof CircuitOpenError) {
            circuitOpen = true;
            requeue.push(user);
            metrics.deferred++;
            details.push({ userId: user.id, outcome: "deferred" });
            return;
          }
          throw result.error;
        case "complete":
          break;
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
      const message = error instanceof Error ? error.message : String(error);
      details.push({ userId: user.id, outcome: "failed", error: message });
      logger.error("Tip reconciliation failed for user", {
        operation: "reconcileStaleTipTotals",
        userId: user.id,
        errorMessage: message,
      });
    }
  });

  // Users that made no attempt, or need more pages, keep their place in the
  // queue instead of waiting out the failure backoff.
  for (const user of requeue) {
    await executor(
      `UPDATE users SET tips_reconcile_attempted_at = $2 WHERE id = $1`,
      [user.id, user.prev_attempted_at]
    );
  }

  const alerts: string[] = [];
  if (metrics.large_discrepancies > 0) {
    alerts.push(
      `${metrics.large_discrepancies} user(s) had tip totals corrected by at least ` +
        `${fromStroops(alertThreshold)} XLM (e.g. ${largeDiscrepancyUsers.slice(0, 5).join(", ")})`
    );
  }
  if (circuitOpen) {
    alerts.push(
      `Horizon circuit open: the run stopped early and ${metrics.deferred} user(s) were deferred`
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
