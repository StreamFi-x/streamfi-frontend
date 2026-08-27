import type { Raid } from "./types";
import { raidStore } from "./seedData";

export class SelfRaidError extends Error {}

const REDIRECT_DELAY_SECONDS = 10;

function generateRaidId(): string {
  return `raid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initiates a raid from one channel to another. Viewers are redirected
 * after a 10 second countdown (`redirect_at`), giving the raid a brief
 * pending window in which it can still be cancelled.
 */
export function initiateRaid(channelId: string, targetChannelId: string): Raid {
  if (channelId === targetChannelId) {
    throw new SelfRaidError("a channel cannot raid itself");
  }

  const now = new Date();
  const redirectAt = new Date(now.getTime() + REDIRECT_DELAY_SECONDS * 1000);

  const raid: Raid = {
    raid_id: generateRaidId(),
    from_channel_id: channelId,
    to_channel_id: targetChannelId,
    status: "pending",
    initiated_at: now.toISOString(),
    redirect_at: redirectAt.toISOString(),
    cancelled_at: null,
  };

  raidStore.set(raid.raid_id, raid);
  return raid;
}
