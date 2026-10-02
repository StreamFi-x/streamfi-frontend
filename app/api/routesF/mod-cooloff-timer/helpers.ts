import { ModAction, ModActionRecord } from './types';

// Cooloff periods in seconds
const COOLOFF_PERIODS: Record<ModAction, number> = {
  ban: 30,
  timeout: 5,
  warn: 0,
  mute: 5,
};

// In-memory store for mod action records
// In production, this would be a persistent database
const MOD_ACTION_RECORDS = new Map<string, ModActionRecord>();

export function getCooloffPeriod(action: ModAction): number {
  return COOLOFF_PERIODS[action] ?? 0;
}

export function getLastActionTimestamp(modId: string): ModActionRecord | null {
  return MOD_ACTION_RECORDS.get(modId) ?? null;
}

export function recordModAction(modId: string, action: ModAction): number {
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  MOD_ACTION_RECORDS.set(modId, {
    mod_id: modId,
    last_action_timestamp: timestamp,
    last_action: action,
  });
  return timestamp;
}

export function isActionAllowed(modId: string, action: ModAction): { allowed: boolean; secondsRemaining: number } {
  const lastRecord = getLastActionTimestamp(modId);
  const cooloffPeriod = getCooloffPeriod(action);

  // No cooloff period for this action
  if (cooloffPeriod === 0) {
    return { allowed: true, secondsRemaining: 0 };
  }

  // No previous action recorded
  if (!lastRecord) {
    return { allowed: true, secondsRemaining: 0 };
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const timeSinceLastAction = currentTime - lastRecord.last_action_timestamp;
  const secondsRemaining = cooloffPeriod - timeSinceLastAction;

  if (secondsRemaining <= 0) {
    return { allowed: true, secondsRemaining: 0 };
  }

  return { allowed: false, secondsRemaining };
}

// For testing: clear all records
export function clearAllRecords(): void {
  MOD_ACTION_RECORDS.clear();
}
