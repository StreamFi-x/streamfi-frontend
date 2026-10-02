import type { HostModeState } from "./types";
import { hostModeStore } from "./seedData";

export class ChannelNotFoundError extends Error {}
export class NotHostingError extends Error {}

/**
 * Clear the channel currently being hosted, if any, and return the state
 * that was cleared.
 */
export function clearHostMode(channelId: string): {
  state: HostModeState;
  cleared_channel_id: string;
} {
  const current = hostModeStore.get(channelId);
  if (!current) {
    throw new ChannelNotFoundError(`channel '${channelId}' not found`);
  }
  if (!current.hosted_channel_id) {
    throw new NotHostingError(`channel '${channelId}' is not currently hosting another channel`);
  }

  const cleared_channel_id = current.hosted_channel_id;
  const updated: HostModeState = {
    channel_id: channelId,
    hosted_channel_id: null,
    started_at: null,
  };
  hostModeStore.set(channelId, updated);

  return { state: updated, cleared_channel_id };
}
