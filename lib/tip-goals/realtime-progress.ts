/**
 * Real-time progress synchronization for tip goals.
 * 
 * Publishes goal progress to viewers without per-viewer RPC polling.
 */

import { getGlobalRealtimeClient } from "@/lib/realtime/client";
import type { TipGoalProgressUpdate } from "./types";

const PROGRESS_CHANNEL_PREFIX = "tip-goal";

/**
 * Get the realtime channel name for a goal's progress.
 */
export function getProgressChannelName(goalId: string): string {
  return `${PROGRESS_CHANNEL_PREFIX}:${goalId}:progress`;
}

/**
 * Publish a progress update to all viewers watching a goal.
 * 
 * Called after:
 * - A new contribution is recorded
 * - Goal is reached
 * - Deadline passes
 * - Refund is complete
 */
export async function publishProgressUpdate(
  update: TipGoalProgressUpdate
): Promise<void> {
  try {
    const client = getGlobalRealtimeClient();
    const channel = getProgressChannelName(update.goalId);

    // Publish the update to all subscribers of this goal's progress channel
    await client.publish(channel, {
      event: "tip-goal:progress",
      data: update,
      timestamp: Date.now(),
    });

    console.log(`[realtime-progress] published update for goal ${update.goalId}`);
  } catch (err) {
    console.error("[realtime-progress] error publishing update:", err);
    // Don't throw; progress publishing is best-effort
    // Viewers will see stale progress until next sync
  }
}

/**
 * Publish a goal-reached event.
 */
export async function publishGoalReached(goalId: string): Promise<void> {
  try {
    const client = getGlobalRealtimeClient();
    const channel = getProgressChannelName(goalId);

    await client.publish(channel, {
      event: "tip-goal:reached",
      data: { goalId },
      timestamp: Date.now(),
    });

    console.log(`[realtime-progress] published goal-reached for ${goalId}`);
  } catch (err) {
    console.error("[realtime-progress] error publishing goal-reached:", err);
  }
}

/**
 * Publish a deadline-passed event.
 */
export async function publishDeadlinePassed(goalId: string): Promise<void> {
  try {
    const client = getGlobalRealtimeClient();
    const channel = getProgressChannelName(goalId);

    await client.publish(channel, {
      event: "tip-goal:deadline-passed",
      data: { goalId },
      timestamp: Date.now(),
    });

    console.log(
      `[realtime-progress] published deadline-passed for ${goalId}`
    );
  } catch (err) {
    console.error("[realtime-progress] error publishing deadline-passed:", err);
  }
}

/**
 * Publish a refund-complete event.
 */
export async function publishRefundComplete(
  goalId: string,
  successCount: number,
  failureCount: number
): Promise<void> {
  try {
    const client = getGlobalRealtimeClient();
    const channel = getProgressChannelName(goalId);

    await client.publish(channel, {
      event: "tip-goal:refund-complete",
      data: { goalId, successCount, failureCount },
      timestamp: Date.now(),
    });

    console.log(
      `[realtime-progress] published refund-complete for ${goalId}: ${successCount} success, ${failureCount} failed`
    );
  } catch (err) {
    console.error("[realtime-progress] error publishing refund-complete:", err);
  }
}

/**
 * Subscription hook for React components to listen to goal progress.
 * 
 * Usage:
 * ```
 * const { data, isConnected } = useGoalProgress(goalId);
 * ```
 * 
 * This would typically be a hook that calls useRealtimeChannel
 * with the progress channel name.
 */
export function useGoalProgress(goalId: string) {
  // This is a placeholder for the React hook implementation.
  // The actual hook would use useRealtimeChannel from @/hooks/useRealtime
  // and subscribe to the progress channel.
  return {
    channel: getProgressChannelName(goalId),
    // Components would handle the subscription via useRealtimeChannel hook
  };
}
