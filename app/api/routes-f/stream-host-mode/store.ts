import type { HostModeState } from "../stream-host-mode-clear/types";
import { hostModeStore } from "../stream-host-mode-clear/seedData";

export class ChannelNotFoundError extends Error {}
export class TargetChannelNotFoundError extends Error {}
export class SelfHostError extends Error {}

/**
 * Sets `channelId` to embed/host `targetChannelId`'s live stream on its
 * channel page. Shares `hostModeStore` with stream-host-mode-clear (the
 * pair of endpoints operate on the same state — set vs. clear).
 */
export function setHostMode(
  channelId: string,
  targetChannelId: string,
): { state: HostModeState } {
  if (!hostModeStore.has(channelId)) {
    throw new ChannelNotFoundError(`channel '${channelId}' not found`);
  }
  if (!hostModeStore.has(targetChannelId)) {
    throw new TargetChannelNotFoundError(
      `target channel '${targetChannelId}' not found`,
    );
  }
  if (channelId === targetChannelId) {
    throw new SelfHostError("a channel cannot host itself");
  }

  const updated: HostModeState = {
    channel_id: channelId,
    hosted_channel_id: targetChannelId,
    started_at: new Date().toISOString(),
  };
  hostModeStore.set(channelId, updated);

  return { state: updated };
}
