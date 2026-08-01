// Shared in-memory state and quiet-hours logic for the
// quiet-hours-notification-config routesF folder (scope constraint: no
// imports from lib/, so this is duplicated here rather than reused from
// any shared app module).

export interface QuietHoursConfig {
  viewer_id: string;
  start_hour: number;
  end_hour: number;
  timezone: string;
  enabled: boolean;
}

export const DEFAULT_CONFIG: Omit<QuietHoursConfig, 'viewer_id'> = {
  start_hour: 22,
  end_hour: 8,
  timezone: 'UTC',
  enabled: false,
};

// In-memory store, keyed by viewer id. Module-level so the choice persists
// across requests within a server instance; a real deployment would back
// this with the user preferences table.
const configStore = new Map<string, Omit<QuietHoursConfig, 'viewer_id'>>();

/** Test hook: reset stored configs between test cases. */
export function __resetQuietHoursStore(): void {
  configStore.clear();
}

export function getConfig(viewerId: string): QuietHoursConfig {
  const stored = configStore.get(viewerId);
  return { viewer_id: viewerId, ...(stored ?? DEFAULT_CONFIG) };
}

export function setConfig(viewerId: string, config: Omit<QuietHoursConfig, 'viewer_id'>): QuietHoursConfig {
  configStore.set(viewerId, config);
  return { viewer_id: viewerId, ...config };
}

/** Returns true if `timezone` is a valid IANA time zone name Intl accepts. */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Extracts the local hour (0-23) `date` falls on in `timezone`. */
export function hourInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hourCycle: 'h23',
  });
  return Number(formatter.format(date));
}

/**
 * Whether `hour` (0-23) falls within the [startHour, endHour) quiet window.
 * Handles a window that crosses midnight (e.g. 22 -> 8) by treating it as
 * "hour >= start OR hour < end" instead of the same-day "hour >= start AND
 * hour < end". start === end is treated as a full 24h window (always
 * quiet) rather than zero-width (never quiet) — the more useful reading of
 * "quiet hours start and end at the same time".
 */
export function isHourInQuietWindow(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

/** Whether `at` (an instant) falls within `config`'s quiet hours window, in
 * the configured timezone. Always false when the config is disabled. */
export function isInQuietHours(config: QuietHoursConfig, at: Date): boolean {
  if (!config.enabled) return false;
  const hour = hourInTimezone(at, config.timezone);
  return isHourInQuietWindow(hour, config.start_hour, config.end_hour);
}
