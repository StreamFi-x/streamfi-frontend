import type { Raid } from "./types";
import { raidStore } from "./seedData";

export class RaidNotFoundError extends Error {}
export class RaidNotOwnedError extends Error {}
export class RaidNotPendingError extends Error {}

/**
 * Cancel a pending raid before it redirects viewers. Only the raid's
 * originating channel may cancel it, and only while it is still in the
 * pre-redirect countdown window (status === "pending").
 */
export function cancelRaid(raidId: string, channelId: string): Raid {
  const raid = raidStore.get(raidId);
  if (!raid) {
    throw new RaidNotFoundError(`raid '${raidId}' not found`);
  }
  if (raid.from_channel_id !== channelId) {
    throw new RaidNotOwnedError(`channel '${channelId}' did not initiate raid '${raidId}'`);
  }
  if (raid.status !== "pending") {
    throw new RaidNotPendingError(`raid '${raidId}' is already ${raid.status}`);
  }

  const updated: Raid = {
    ...raid,
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
  };
  raidStore.set(raidId, updated);

  return updated;
}
