/**
 * Refund processor for failed tip-goals.
 * 
 * Handles per-contributor refunds with retry logic and failure tracking.
 * Called by background job when a goal deadline passes without reaching the threshold.
 */

import { sql } from "@vercel/postgres";
import type { TipGoalContribution, RefundRetryConfig } from "./types";
import { DEFAULT_REFUND_CONFIG } from "./types";

/**
 * Result of a refund processing run.
 */
export interface RefundProcessingResult {
  goal_id: string;
  total_contributions: number;
  refunded_count: number;
  failed_count: number;
  unreachable_count: number;
  pending_retry_count: number;
}

/**
 * Initiate refunds for a goal that failed to reach its threshold.
 * 
 * Called when a goal's deadline passes and status is DEADLINE_PASSED.
 * Transitions goal to REFUNDING and queues refunds for all contributions.
 */
export async function initiateGoalRefunds(goalId: string): Promise<void> {
  try {
    await sql.begin(async (sqlTransaction) => {
      // 1. Verify goal is in DEADLINE_PASSED state
      const goalResult = await sqlTransaction`
        SELECT id, status FROM tip_goals WHERE id = ${goalId} FOR UPDATE
      `;

      if (goalResult.rows.length === 0) {
        throw new Error(`Goal not found: ${goalId}`);
      }

      if (goalResult.rows[0].status !== "DEADLINE_PASSED") {
        throw new Error(
          `Cannot refund: goal is in ${goalResult.rows[0].status} state, not DEADLINE_PASSED`
        );
      }

      // 2. Transition goal to REFUNDING
      await sqlTransaction`
        UPDATE tip_goals
        SET status = 'REFUNDING', updated_at = NOW()
        WHERE id = ${goalId}
      `;

      // 3. Mark all contributions as ready for refund (set refund_next_retry_at to now)
      await sqlTransaction`
        UPDATE tip_goal_contributions
        SET 
          refund_next_retry_at = NOW(),
          refund_attempt_count = 0
        WHERE goal_id = ${goalId} AND refunded = FALSE
      `;
    });

    console.log(`[refund-processor] initiated refunds for goal ${goalId}`);
  } catch (err) {
    console.error("[refund-processor] error initiating refunds:", err);
    throw err;
  }
}

/**
 * Process pending refunds for a goal.
 * 
 * This is called by a background job (e.g., every 5 minutes) to retry failed refunds
 * and process new ones. For each pending refund:
 * 
 * 1. Try to issue a refund transaction from escrow to contributor
 * 2. On success: mark refund_tx_hash and set refunded = true
 * 3. On failure: categorize the failure and schedule retry
 */
export async function processPendingRefunds(
  goalId: string,
  escrowSecretKey: string,
  creatorXlmAccount: string,
  config: RefundRetryConfig = DEFAULT_REFUND_CONFIG
): Promise<RefundProcessingResult> {
  try {
    // 1. Get all pending refunds for this goal
    const pendingResult = await sql`
      SELECT 
        id, contributor_wallet, amount_xlm, refund_attempt_count
      FROM tip_goal_contributions
      WHERE 
        goal_id = ${goalId}
        AND refunded = FALSE
        AND (refund_next_retry_at IS NULL OR refund_next_retry_at <= NOW())
      ORDER BY created_at ASC
      LIMIT 100
    `;

    const pending = pendingResult.rows as Array<{
      id: string;
      contributor_wallet: string;
      amount_xlm: string;
      refund_attempt_count: number;
    }>;

    let refundedCount = 0;
    let failedCount = 0;
    let unreachableCount = 0;

    // 2. Process each refund
    for (const contribution of pending) {
      try {
        // Issue refund transaction (placeholder for Stellar SDK call)
        const refundTxHash = await issueRefundTransaction(
          escrowSecretKey,
          contribution.contributor_wallet,
          contribution.amount_xlm
        );

        // Mark as refunded
        await sql`
          UPDATE tip_goal_contributions
          SET 
            refunded = TRUE,
            refund_tx_hash = ${refundTxHash},
            refund_attempted_at = NOW(),
            refund_attempt_count = refund_attempt_count + 1,
            refund_failed_reason = NULL,
            refund_next_retry_at = NULL
          WHERE id = ${contribution.id}
        `;

        refundedCount++;
      } catch (err: any) {
        const errorMsg = String(err.message || err);
        const isUnreachable = isUnreachableAccountError(errorMsg);

        if (isUnreachable) {
          // Account cannot receive XLM; mark as unreachable
          await sql`
            UPDATE tip_goal_contributions
            SET 
              refund_failed_reason = 'unreachable_account',
              refund_attempted_at = NOW(),
              refund_attempt_count = refund_attempt_count + 1,
              refund_next_retry_at = NULL
            WHERE id = ${contribution.id}
          `;

          unreachableCount++;
          console.warn(
            `[refund-processor] unreachable account for ${contribution.contributor_wallet}, goal ${goalId}`
          );
        } else {
          // Transient error; schedule retry
          const nextRetry = calculateNextRetry(
            contribution.refund_attempt_count,
            config
          );

          if (nextRetry !== null) {
            await sql`
              UPDATE tip_goal_contributions
              SET 
                refund_failed_reason = 'transient_failure',
                refund_attempted_at = NOW(),
                refund_attempt_count = refund_attempt_count + 1,
                refund_next_retry_at = ${nextRetry}
              WHERE id = ${contribution.id}
            `;

            failedCount++;
          } else {
            // Retries exhausted
            await sql`
              UPDATE tip_goal_contributions
              SET 
                refund_failed_reason = 'max_retries_exceeded',
                refund_attempted_at = NOW(),
                refund_attempt_count = refund_attempt_count + 1,
                refund_next_retry_at = NULL
              WHERE id = ${contribution.id}
            `;

            failedCount++;
            console.error(
              `[refund-processor] max retries exceeded for ${contribution.contributor_wallet}, goal ${goalId}`
            );
          }
        }
      }
    }

    // 3. Check if all refunds are complete (no more pending)
    const remainingResult = await sql`
      SELECT COUNT(*) as count FROM tip_goal_contributions
      WHERE goal_id = ${goalId} AND refunded = FALSE
    `;

    const remaining = remainingResult.rows[0].count;

    if (remaining === 0) {
      // All refunds complete (or unreachable/failed)
      await sql`
        UPDATE tip_goals
        SET 
          status = 'REFUND_COMPLETE',
          refund_completed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${goalId}
      `;
    }

    return {
      goal_id: goalId,
      total_contributions: pending.length,
      refunded_count: refundedCount,
      failed_count: failedCount,
      unreachable_count: unreachableCount,
      pending_retry_count: remaining,
    };
  } catch (err) {
    console.error("[refund-processor] error processing refunds:", err);
    throw err;
  }
}

/**
 * Issue a refund transaction from escrow to contributor.
 * 
 * This is a placeholder. In production, it would:
 * 1. Sign a transaction with the escrow secret key
 * 2. Send the refund amount to the contributor's wallet
 * 3. Return the transaction hash
 * 4. Throw if the transaction fails
 */
async function issueRefundTransaction(
  escrowSecretKey: string,
  contributorWallet: string,
  amountXlm: string
): Promise<string> {
  // TODO: Implement actual Stellar transaction signing and submission
  // This would use the Stellar SDK (or similar) to:
  // 1. Build a payment transaction from escrow to contributor
  // 2. Sign with escrowSecretKey
  // 3. Submit to Stellar network
  // 4. Return tx hash or throw on failure

  // For now, return a mock hash
  console.log(
    `[refund-processor] Would refund ${amountXlm} XLM to ${contributorWallet}`
  );
  return `mock-refund-tx-${Date.now()}`;
}

/**
 * Determine if an error indicates an unreachable account.
 * 
 * Examples:
 * - "Account does not exist"
 * - "No trust line for XLM"
 * - "Trustline amount limit exceeded"
 */
function isUnreachableAccountError(errorMsg: string): boolean {
  const unreachablePatterns = [
    /account.*does.?not.*exist/i,
    /no.?trust.?line/i,
    /trustline.*limit/i,
    /destination.*requires/i,
  ];

  return unreachablePatterns.some((pattern) => pattern.test(errorMsg));
}

/**
 * Calculate the next retry time based on exponential backoff.
 */
function calculateNextRetry(
  attemptCount: number,
  config: RefundRetryConfig
): Date | null {
  if (attemptCount >= config.maxRetries) {
    return null; // Retries exhausted
  }

  const backoffMs = Math.min(
    config.initialBackoffMs * Math.pow(config.exponentialBase, attemptCount),
    config.maxBackoffMs
  );

  return new Date(Date.now() + backoffMs);
}
