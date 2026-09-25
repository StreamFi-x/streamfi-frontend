/**
 * Periodic reconciliation of tip_transactions against the Horizon ledger
 * (prerequisite for the #1405 alerting layer).
 *
 * For every creator that has tip rows, the incoming native payments of the
 * last LOOKBACK window are compared with the stored rows by transaction hash:
 *
 *   MISSING_TIP_INSERTED  on the ledger, not in the DB       -> row inserted
 *   AMOUNT_CORRECTED      stored amount differs from ledger   -> amount updated
 *   CREATOR_MISMATCH      tx stored under a different creator -> flagged only
 *   NOT_ON_LEDGER         stored row with no matching payment -> flagged only
 *
 * Every applied correction and its audit row are written by ONE statement, so
 * tip_reconciliation_corrections can never disagree with what was changed; the
 * alert layer aggregates from that table. Corrections are conditional (insert
 * ON CONFLICT DO NOTHING, update WHERE amount = old value), so a retried run, a
 * concurrent run or a concurrent /api/tips/refresh-total cannot apply the same
 * correction twice or overwrite newer data. Financial rows are never deleted.
 */
import { sql } from "@vercel/postgres";
import {
  fetchPaymentsReceived,
  isHorizonNotFound,
} from "@/lib/stellar/horizon";
import { absStroops, fromStroops, toStroops } from "@/lib/stellar/amounts";
import { withRetry } from "@/lib/jobs/retry";
import { errorMessage } from "@/lib/jobs/runs";
import type { JobBodyResult, JobContext } from "@/lib/jobs/run-job";

const HOUR_MS = 60 * 60 * 1000;
const PAGE_SIZE = 200;
const MAX_PAGES_PER_CREATOR = 10;
const CREATOR_BATCH = 100;
/**
 * Stored rows newer than windowStart + this margin are checked against the
 * ledger; the margin keeps rows at the very edge of the fetched window from
 * being reported as NOT_ON_LEDGER.
 */
const WINDOW_EDGE_MARGIN_MS = HOUR_MS;

export function lookbackHours(): number {
  const configured = Number(process.env.TIP_RECONCILIATION_LOOKBACK_HOURS);
  return Number.isFinite(configured) && configured >= 1 ? configured : 72;
}

export interface TipReconMetrics {
  creators_scanned: number;
  creators_failed: number;
  creators_incomplete: number;
  payments_scanned: number;
  stored_rows_checked: number;
  failed_creator_ids: string[];
}

interface LedgerTip {
  txHash: string;
  sender: string;
  stroops: bigint;
  timestamp: string;
}

interface StoredTip {
  id: string;
  txHash: string;
  creatorId: string;
  amount: string;
  createdAt: Date;
}

export async function runTipReconciliation(
  ctx: JobContext
): Promise<JobBodyResult<TipReconMetrics>> {
  const metrics: TipReconMetrics = {
    creators_scanned: 0,
    creators_failed: 0,
    creators_incomplete: 0,
    payments_scanned: 0,
    stored_rows_checked: 0,
    failed_creator_ids: [],
  };

  const { rows: clock } = await sql`SELECT now() AS now`;
  const windowStart = new Date(
    new Date(clock[0].now).getTime() - lookbackHours() * HOUR_MS
  );

  let cursor = "00000000-0000-0000-0000-000000000000";
  let partial = false;
  for (;;) {
    const { rows: creators } = await sql`
      SELECT u.id, u.wallet
      FROM users u
      WHERE u.id > ${cursor}::uuid
        AND u.wallet ~ '^G[A-Z2-7]{55}$'
        AND EXISTS (SELECT 1 FROM tip_transactions t WHERE t.creator_id = u.id)
      ORDER BY u.id
      LIMIT ${CREATOR_BATCH}
    `;
    if (creators.length === 0) {
      break;
    }
    cursor = String(creators[creators.length - 1].id);

    for (const creator of creators) {
      if (ctx.deadlineExpired()) {
        partial = true;
        break;
      }
      metrics.creators_scanned++;
      try {
        const complete = await reconcileCreator(
          ctx.runId,
          String(creator.id),
          String(creator.wallet),
          windowStart,
          metrics
        );
        if (!complete) {
          metrics.creators_incomplete++;
        }
      } catch (err) {
        // One creator's Horizon/DB failure must not stop the run.
        metrics.creators_failed++;
        if (metrics.failed_creator_ids.length < 20) {
          metrics.failed_creator_ids.push(String(creator.id));
        }
        console.error(
          `[tip-reconciliation] creator ${creator.id} failed: ${errorMessage(err)}`
        );
      }
    }
    if (partial) {
      break;
    }
    await ctx.renewLease();
  }

  return {
    status:
      partial || metrics.creators_failed > 0 || metrics.creators_incomplete > 0
        ? "partial"
        : "completed",
    metrics,
  };
}

function isRetryableHorizonError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  // No response at all = network error / timeout.
  return status === undefined || status === 429 || status >= 500;
}

/**
 * Incoming native payments to `wallet` since windowStart, aggregated per
 * transaction (a transaction can carry several payment operations; the table
 * stores one row per tx_hash). `complete` is false when the page cap was hit
 * before reaching windowStart.
 */
async function fetchLedgerTips(
  wallet: string,
  windowStart: Date
): Promise<{ tips: Map<string, LedgerTip>; complete: boolean }> {
  const tips = new Map<string, LedgerTip>();
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES_PER_CREATOR; page++) {
    let result: Awaited<ReturnType<typeof fetchPaymentsReceived>>;
    try {
      result = await withRetry(
        () =>
          fetchPaymentsReceived({
            publicKey: wallet,
            limit: PAGE_SIZE,
            cursor,
          }),
        { attempts: 3, baseDelayMs: 500, isRetryable: isRetryableHorizonError }
      );
    } catch (err) {
      if (isHorizonNotFound(err)) {
        // The account does not exist on this network: it has no payments.
        return { tips, complete: true };
      }
      throw err;
    }

    for (const tip of result.tips) {
      if (new Date(tip.timestamp) < windowStart) {
        continue;
      }
      const existing = tips.get(tip.txHash);
      tips.set(tip.txHash, {
        txHash: tip.txHash,
        sender: tip.sender,
        stroops: (existing?.stroops ?? BigInt(0)) + toStroops(tip.amount),
        timestamp: existing?.timestamp ?? tip.timestamp,
      });
    }

    const reachedWindowStart =
      !result.oldestRecordAt || new Date(result.oldestRecordAt) < windowStart;
    if (!result.nextCursor || reachedWindowStart) {
      return { tips, complete: true };
    }
    cursor = result.nextCursor;
  }
  return { tips, complete: false };
}

async function loadStoredTips(
  creatorId: string,
  txHashes: string[],
  windowStart: Date
): Promise<{ byHash: Map<string, StoredTip>; inWindow: StoredTip[] }> {
  const { rows } = await sql`
    SELECT id, tx_hash, creator_id, amount_xlm::text AS amount, created_at
    FROM tip_transactions
    WHERE tx_hash IS NOT NULL
      AND (
        tx_hash IN (SELECT jsonb_array_elements_text(${JSON.stringify(txHashes)}::jsonb))
        OR (creator_id = ${creatorId} AND created_at >= ${windowStart.toISOString()}::timestamptz)
      )
  `;
  const byHash = new Map<string, StoredTip>();
  const inWindow: StoredTip[] = [];
  const edge = windowStart.getTime() + WINDOW_EDGE_MARGIN_MS;
  for (const row of rows) {
    const tip: StoredTip = {
      id: String(row.id),
      txHash: String(row.tx_hash),
      creatorId: String(row.creator_id),
      amount: String(row.amount),
      createdAt: new Date(row.created_at),
    };
    byHash.set(tip.txHash, tip);
    if (tip.creatorId === creatorId && tip.createdAt.getTime() >= edge) {
      inWindow.push(tip);
    }
  }
  return { byHash, inWindow };
}

/** Returns false when the ledger window could not be read completely. */
async function reconcileCreator(
  runId: string,
  creatorId: string,
  wallet: string,
  windowStart: Date,
  metrics: TipReconMetrics
): Promise<boolean> {
  const ledger = await fetchLedgerTips(wallet, windowStart);
  metrics.payments_scanned += ledger.tips.size;

  const stored = await loadStoredTips(
    creatorId,
    [...ledger.tips.keys()],
    windowStart
  );

  for (const tip of ledger.tips.values()) {
    const row = stored.byHash.get(tip.txHash);
    if (!row) {
      await insertMissingTip(runId, creatorId, tip);
      continue;
    }
    if (row.creatorId !== creatorId) {
      await recordFlag(runId, "CREATOR_MISMATCH", row, tip.stroops);
      continue;
    }
    if (toStroops(row.amount) !== tip.stroops) {
      await correctAmount(runId, row, tip.stroops);
    }
  }

  // Only a complete ledger window can prove a stored row has no payment.
  if (ledger.complete) {
    for (const row of stored.inWindow) {
      metrics.stored_rows_checked++;
      if (!ledger.tips.has(row.txHash)) {
        await recordFlag(runId, "NOT_ON_LEDGER", row, null);
      }
    }
  }
  return ledger.complete;
}

async function insertMissingTip(
  runId: string,
  creatorId: string,
  tip: LedgerTip
) {
  const amount = fromStroops(tip.stroops);
  // price_usd is left NULL: the historical rate at tip time is unknown.
  const { rows } = await sql`
    WITH supporter AS (
      -- tombstone-aware: financial records keep their supporter link
      SELECT id FROM users WHERE wallet = ${tip.sender} LIMIT 1
    ),
    ins AS (
      INSERT INTO tip_transactions (creator_id, supporter_id, amount_xlm, tx_hash, memo, created_at)
      VALUES (
        ${creatorId}, (SELECT id FROM supporter), ${amount}::numeric,
        ${tip.txHash}, 'StreamFi Tip', ${tip.timestamp}::timestamptz
      )
      ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO NOTHING
      RETURNING id
    )
    INSERT INTO tip_reconciliation_corrections
      (run_id, kind, applied, tip_transaction_id, tx_hash, creator_id, amount_before, amount_after, delta_abs)
    SELECT ${runId}, 'MISSING_TIP_INSERTED', true, ins.id, ${tip.txHash}, ${creatorId},
           NULL, ${amount}::numeric, ${amount}::numeric
    FROM ins
    ON CONFLICT (run_id, kind, tx_hash) DO NOTHING
    RETURNING id
  `;
  if (rows.length === 0) {
    // Another writer inserted this tx concurrently; nothing was changed here.
    console.log(
      `[tip-reconciliation] ${tip.txHash} inserted concurrently; no correction recorded`
    );
  }
}

async function correctAmount(runId: string, row: StoredTip, ledger: bigint) {
  const after = fromStroops(ledger);
  const delta = fromStroops(absStroops(ledger - toStroops(row.amount)));
  await sql`
    WITH upd AS (
      UPDATE tip_transactions
      SET amount_xlm = ${after}::numeric
      WHERE id = ${row.id} AND amount_xlm = ${row.amount}::numeric
      RETURNING id
    )
    INSERT INTO tip_reconciliation_corrections
      (run_id, kind, applied, tip_transaction_id, tx_hash, creator_id, amount_before, amount_after, delta_abs)
    SELECT ${runId}, 'AMOUNT_CORRECTED', true, upd.id, ${row.txHash}, ${row.creatorId},
           ${row.amount}::numeric, ${after}::numeric, ${delta}::numeric
    FROM upd
    ON CONFLICT (run_id, kind, tx_hash) DO NOTHING
  `;
}

async function recordFlag(
  runId: string,
  kind: "CREATOR_MISMATCH" | "NOT_ON_LEDGER",
  row: StoredTip,
  ledger: bigint | null
) {
  await sql`
    INSERT INTO tip_reconciliation_corrections
      (run_id, kind, applied, tip_transaction_id, tx_hash, creator_id, amount_before, amount_after, delta_abs)
    VALUES (
      ${runId}, ${kind}, false, ${row.id}, ${row.txHash}, ${row.creatorId},
      ${row.amount}::numeric,
      ${ledger === null ? null : fromStroops(ledger)}::numeric,
      ${row.amount}::numeric
    )
    ON CONFLICT (run_id, kind, tx_hash) DO NOTHING
  `;
}
