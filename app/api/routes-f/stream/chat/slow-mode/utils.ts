import type { SlowModeData } from "./types";

export const slowModeStore = new Map<string, SlowModeData>();

const INTERVAL_MIN = 2;
const INTERVAL_MAX = 300;

export function getSlowModeState(streamId: string): SlowModeData | undefined {
  return slowModeStore.get(streamId);
}

export function setSlowMode(
  streamId: string,
  intervalSeconds: number
): SlowModeData {
  const data: SlowModeData = {
    enabled: true,
    interval_seconds: intervalSeconds,
  };
  slowModeStore.set(streamId, data);
  return data;
}

export function disableSlowMode(streamId: string): void {
  slowModeStore.delete(streamId);
}

export function validateInterval(interval: number): {
  valid: boolean;
  error?: string;
} {
  if (typeof interval !== "number") {
    return { valid: false, error: "interval_seconds must be a number" };
  }

  if (isNaN(interval)) {
    return { valid: false, error: "interval_seconds must be a valid number" };
  }

  if (!Number.isInteger(interval)) {
    return {
      valid: false,
      error: "interval_seconds must be an integer",
    };
  }

  if (interval < INTERVAL_MIN) {
    return {
      valid: false,
      error: `interval_seconds must be at least ${INTERVAL_MIN} seconds`,
    };
  }

  if (interval > INTERVAL_MAX) {
    return {
      valid: false,
      error: `interval_seconds must be at most ${INTERVAL_MAX} seconds`,
    };
  }

  return { valid: true };
}
