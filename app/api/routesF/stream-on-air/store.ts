import { OnAirState } from "./types";

const states = new Map<string, OnAirState>();

export function getOnAir(creatorId: string): OnAirState | null {
  return states.get(creatorId) ?? null;
}

/**
 * Set the on-air signal. `since` only moves when the value actually changes,
 * so hardware polling GET can report a stable "live for N seconds".
 */
export function setOnAir(
  creatorId: string,
  onAir: boolean
): { state: OnAirState; changed: boolean } {
  const existing = states.get(creatorId);

  if (existing && existing.on_air === onAir) {
    return { state: existing, changed: false };
  }

  const state: OnAirState = {
    creator_id: creatorId,
    on_air: onAir,
    since: new Date().toISOString(),
  };
  states.set(creatorId, state);
  return { state, changed: true };
}

export function durationSeconds(since: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 1000));
}

export function clearOnAirStates(): void {
  states.clear();
}
