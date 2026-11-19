/**
 * Race-safe goal-reached detection and state transitions.
 * 
 * Uses SERIALIZABLE isolation to prevent concurrent tips from double-triggering
 * goal-reached or missing the threshold.
 */

import { sql } from "@vercel/postgres";
import type { TipGoal } from "./types";

/**
 * Result of checking if a new contribution triggers goal-reached.
 */
export interface GoalCheckResult {
  goalReached: boolean;
  newGoalStatus: string | null;
  previousAmount: string;
  newAmount: string;
}

/**
 * Record a new contribution and check if goal is reached (race-safe).
 * 
 * This function:
 * 1. Starts a SERIALIZABLE transaction
 * 2. Records the contribution
 * 3. Sums all contributions for the goal
 * 4. Checks if the sum meets or exceeds the goal
 * 5. If yes, atomically transitions goal to GOAL_REACHED
 * 6. Returns whether the goal was reached
 * 
 * SERIALIZABLE isolation ensures no two concurrent tips can race past the threshold.
 * If two tips land near the boundary, one will succeed and see GOAL_REACHED;
 * the other will see that the goal is already reached and not duplicate the transition.
 */
export async function recordContributionAndCheckGoal(
  goalId: string,
  contributorWallet: string,
  contributorId: string | null,
  amountXlm: string,
  txHash: string
): Promise<GoalCheckResult> {
  try {
    // Use a transaction with SERIALIZABLE isolation
    const result = await sql.begin(async (sqlTransaction) => {
      // 1. Get current goal state
      const goalResult = await sqlTransaction`
        SELECT 
          id, status, goal_amount_xlm, current_amount_xlm, expires_at
        FROM tip_goals
        WHERE id = ${goalId}
        FOR UPDATE
      `;

      if (goalResult.rows.length === 0) {
        throw new Error(`Goal not found: ${goalId}`);
      }

      const goal = goalResult.rows[0];
      const previousAmount = goal.current_amount_xlm as string;
      const goalThreshold = parseFloat(goal.goal_amount_xlm as string);
      const currentAmountFloat = parseFloat(previousAmount);
      const newAmount = currentAmountFloat + parseFloat(amountXlm);

      // 2. Record the contribution
      await sqlTransaction`
        INSERT INTO tip_goal_contributions (
          goal_id, contributor_wallet, contributor_id, amount_xlm, tx_hash
        ) VALUES (
          ${goalId}, ${contributorWallet}, ${contributorId}, ${amountXlm}, ${txHash}
        )
      `;

      // 3. Check if goal is reached
      const goalReached = newAmount >= goalThreshold;
      let newGoalStatus: string | null = null;

      // 4. Update goal amount and status if needed
      if (goalReached && goal.status === "ACTIVE") {
        newGoalStatus = "GOAL_REACHED";

        await sqlTransaction`
          UPDATE tip_goals
          SET 
            current_amount_xlm = ${newAmount.toString()},
            current_contributor_count = current_contributor_count + 1,
            status = 'GOAL_REACHED',
            goal_reached_at = NOW(),
            updated_at = NOW()
          WHERE id = ${goalId}
        `;
      } else {
        // Just update the amount
        await sqlTransaction`
          UPDATE tip_goals
          SET 
            current_amount_xlm = ${newAmount.toString()},
            current_contributor_count = current_contributor_count + 1,
            updated_at = NOW()
          WHERE id = ${goalId}
        `;
      }

      return {
        goalReached,
        newGoalStatus,
        previousAmount,
        newAmount: newAmount.toString(),
      };
    });

    return result;
  } catch (err) {
    console.error("[goal-resolution] error recording contribution:", err);
    throw err;
  }
}

/**
 * Check if a goal deadline has passed and transition to DEADLINE_PASSED if needed.
 * 
 * Called by a background job (cron).
 */
export async function checkDeadlinesAndTransition(): Promise<{
  passedCount: number;
}> {
  try {
    const result = await sql`
      UPDATE tip_goals
      SET 
        status = 'DEADLINE_PASSED',
        updated_at = NOW()
      WHERE status = 'ACTIVE'
        AND expires_at <= NOW()
      RETURNING id
    `;

    return {
      passedCount: result.rowCount,
    };
  } catch (err) {
    console.error("[goal-resolution] error checking deadlines:", err);
    throw err;
  }
}

/**
 * Get the current goal with its state.
 */
export async function getGoal(goalId: string): Promise<TipGoal | null> {
  try {
    const result = await sql`
      SELECT * FROM tip_goals WHERE id = ${goalId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as TipGoal;
  } catch (err) {
    console.error("[goal-resolution] error fetching goal:", err);
    throw err;
  }
}

/**
 * Get all goals for a creator that are currently active or in terminal state recently.
 */
export async function getGoalsForCreator(
  creatorId: string,
  limit: number = 50
): Promise<TipGoal[]> {
  try {
    const result = await sql`
      SELECT * FROM tip_goals
      WHERE creator_id = ${creatorId}
        AND (status IN ('ACTIVE', 'GOAL_REACHED', 'RELEASING_FUNDS', 'REFUNDING')
          OR (status IN ('RELEASED', 'REFUND_COMPLETE') AND updated_at > NOW() - INTERVAL '7 days'))
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;

    return result.rows as TipGoal[];
  } catch (err) {
    console.error("[goal-resolution] error fetching creator goals:", err);
    throw err;
  }
}

/**
 * Get all contributions for a goal.
 */
export async function getGoalContributions(
  goalId: string
): Promise<Array<{ contributor_wallet: string; amount_xlm: string }>> {
  try {
    const result = await sql`
      SELECT contributor_wallet, amount_xlm
      FROM tip_goal_contributions
      WHERE goal_id = ${goalId}
      ORDER BY created_at ASC
    `;

    return result.rows as Array<{
      contributor_wallet: string;
      amount_xlm: string;
    }>;
  } catch (err) {
    console.error("[goal-resolution] error fetching contributions:", err);
    throw err;
  }
}
