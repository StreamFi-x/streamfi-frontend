import type { EarnRateConfig } from "./types";

export const DEFAULT_POINTS_PER_MINUTE_WATCHED = 10;
export const DEFAULT_POINTS_PER_CHAT_MESSAGE = 5;

const configs = new Map<string, EarnRateConfig>();

export function getConfig(creatorId: string): EarnRateConfig {
  return (
    configs.get(creatorId) ?? {
      creator_id: creatorId,
      points_per_minute_watched: DEFAULT_POINTS_PER_MINUTE_WATCHED,
      points_per_chat_message: DEFAULT_POINTS_PER_CHAT_MESSAGE,
      updated_at: new Date(0).toISOString(),
    }
  );
}

export function setConfig(
  creatorId: string,
  updates: { points_per_minute_watched?: number; points_per_chat_message?: number }
): EarnRateConfig {
  const current = getConfig(creatorId);
  const updated: EarnRateConfig = {
    creator_id: creatorId,
    points_per_minute_watched:
      updates.points_per_minute_watched ?? current.points_per_minute_watched,
    points_per_chat_message:
      updates.points_per_chat_message ?? current.points_per_chat_message,
    updated_at: new Date().toISOString(),
  };
  configs.set(creatorId, updated);
  return updated;
}
