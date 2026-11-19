import { defaultExecutor, type SqlExecutor } from "@/lib/db/executor";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { getXlmUsdPrice } from "@/lib/routes-f/price";
import {
  TIP_RECONCILIATION_JOB,
  evaluatePendingRuns,
} from "@/lib/alerts/tip-reconciliation-alerts";
import {
  reconcileStaleTipTotals,
  reconcileUserTipTotals,
  type FetchPayments,
} from "@/lib/stellar/tip-reconciliation";
import { defineJob, noPayload } from "../definition";
import { PermanentJobError } from "../errors";

/**
 * The tip reconciliation jobs (#1400, #1416, #1418). Both advance the same
 * resumable, checkpointed ledger walk (lib/stellar/tip-reconciliation.ts), so
 * a retried or duplicated delivery only continues from the checkpoint and
 * never counts a tip twice.
 */

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const SCHEDULE_SECONDS = 15 * 60;

/**
 * Every 15 minutes: advances a bounded batch of the stalest creators
 * (formerly the Vercel Cron route /api/routes-f/cron-reconcile-tip-totals).
 */
export const tipTotalReconciliationJob = defineJob({
  name: TIP_RECONCILIATION_JOB,
  description: "Re-derive creators' tip totals from the Stellar ledger",
  schedule: "*/15 * * * *",
  expectedIntervalSeconds: SCHEDULE_SECONDS,
  maxAttempts: 3,
  timeoutSeconds: 55,
  leaseSeconds: 90,
  parsePayload: noPayload,
  run: ({ runId }) =>
    reconcileStaleTipTotals({
      runId,
      batchSize: envInt("TIP_RECONCILE_BATCH_SIZE", 25),
      staleAfterMinutes: envInt("TIP_RECONCILE_STALE_MINUTES", 360),
      concurrency: envInt("TIP_RECONCILE_CONCURRENCY", 2),
      timeBudgetMs: 45_000,
      getXlmUsdPrice,
      onTotalsChanged: async userId => {
        await evaluateAndAwardBadges(userId);
      },
    }),
  // Anomaly alerting on this and any earlier run whose evaluation a crash
  // left pending (#1405).
  afterRun: async () => {
    await evaluatePendingRuns();
  },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STELLAR_ACCOUNT = /^G[A-Z2-7]{55}$/;

export interface TipRefreshPayload {
  userId: string;
}

export interface TipRefreshDeps {
  executor?: SqlExecutor;
  fetchPayments?: FetchPayments;
  getXlmUsdPrice?: () => Promise<number>;
  onTotalsChanged?: (userId: string) => Promise<void>;
}

/**
 * Continues one creator's reconciliation after a manual refresh ran out of
 * its request budget (app/api/tips/refresh-total). Each delivery reads a
 * bounded number of pages; if the history is longer it queues its own
 * continuation. A Horizon failure or open circuit fails the delivery, so
 * QStash retries it with backoff and it resumes at the checkpoint.
 */
export function createTipRefreshJob(deps: TipRefreshDeps = {}) {
  return defineJob({
    name: "tip-refresh-creator",
    description: "Finish one creator's tip reconciliation in the background",
    maxAttempts: 4,
    timeoutSeconds: 55,
    leaseSeconds: 70,
    leaseKey: (payload: TipRefreshPayload) =>
      `tip-refresh-creator:${payload.userId}`,
    parsePayload: (raw: unknown): TipRefreshPayload => {
      const userId = (raw as { userId?: unknown } | null)?.userId;
      if (typeof userId !== "string" || !UUID.test(userId)) {
        throw new PermanentJobError("payload must be { userId: <uuid> }");
      }
      return { userId };
    },
    run: async ({ payload, dispatch }) => {
      const executor = deps.executor ?? defaultExecutor;
      const { rows } = await executor(
        `SELECT wallet FROM users WHERE id = $1`,
        [payload.userId]
      );
      const wallet = rows[0]?.wallet as string | undefined;
      if (!wallet || !STELLAR_ACCOUNT.test(wallet)) {
        throw new PermanentJobError(
          "creator no longer exists or has no Stellar wallet"
        );
      }

      const result = await reconcileUserTipTotals(payload.userId, wallet, {
        executor,
        fetchPayments: deps.fetchPayments,
        getXlmUsdPrice: deps.getXlmUsdPrice ?? getXlmUsdPrice,
        maxPages: 50,
        timeBudgetMs: 40_000,
      });
      const metrics = { pages: result.pages, ledger_requests: result.requests };

      switch (result.status) {
        case "complete":
          if (result.countChanged) {
            await (deps.onTotalsChanged ?? evaluateAndAwardBadges)(
              payload.userId
            );
          }
          return { status: "succeeded", metrics: { ...metrics, complete: 1 } };
        case "in_progress": {
          const next = await dispatch(payload, {
            // One continuation per checkpoint position, however often this
            // delivery is retried or duplicated.
            deduplicationId: `tip-refresh-creator:${payload.userId}:${result.cursor ?? "start"}`,
          });
          // Without QStash the scheduled reconciliation picks it up.
          return {
            status: next.dispatched ? "succeeded" : "partial",
            metrics: { ...metrics, continued: next.dispatched ? 1 : 0 },
          };
        }
        case "superseded":
        case "stale":
          return { status: "succeeded", metrics: { ...metrics, skipped: 1 } };
        case "not_found":
          throw new PermanentJobError("creator no longer exists");
        case "interrupted":
          throw result.error instanceof Error
            ? result.error
            : new Error(String(result.error));
      }
    },
  });
}

export const tipRefreshCreatorJob = createTipRefreshJob();
