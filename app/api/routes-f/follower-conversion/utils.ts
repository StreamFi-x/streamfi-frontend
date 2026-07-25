import type { ViewerEvent, FollowEvent, ConversionResponse } from "./types";

const ONE_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_WINDOW_DAYS = 30;

export function computeConversion(
  viewerEvents: ViewerEvent[],
  followEvents: FollowEvent[],
  windowDays: number,
  now: number = Date.now()
): ConversionResponse {
  const cutoff = now - windowDays * ONE_DAY;

  const viewersInWindow = new Set(
    viewerEvents.filter(e => e.timestamp >= cutoff).map(e => e.viewer)
  );
  const followersInWindow = new Set(
    followEvents.filter(e => e.timestamp >= cutoff).map(e => e.viewer)
  );

  const total_viewers = viewersInWindow.size;
  let new_followers = 0;
  for (const viewer of viewersInWindow) {
    if (followersInWindow.has(viewer)) {
      new_followers += 1;
    }
  }

  const conversion_percent =
    total_viewers === 0
      ? 0
      : roundToTwo((new_followers / total_viewers) * 100);

  return { total_viewers, new_followers, conversion_percent };
}

export function isValidWindowDays(value: unknown): {
  valid: boolean;
  value?: number;
  error?: string;
} {
  if (value === undefined || value === null) {
    return { valid: true, value: DEFAULT_WINDOW_DAYS };
  }

  const parsed = typeof value === "string" ? Number(value) : value;

  if (typeof parsed !== "number" || Number.isNaN(parsed)) {
    return { valid: false, error: "window_days must be a number" };
  }
  if (!Number.isInteger(parsed)) {
    return { valid: false, error: "window_days must be an integer" };
  }
  if (parsed < 1) {
    return { valid: false, error: "window_days must be at least 1" };
  }

  return { valid: true, value: parsed };
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
