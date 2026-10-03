/**
 * Centralized reminder timing policy for scheduled streams (#1428). Every
 * place that needs "how long before the stream does the reminder fire"
 * imports this instead of hard-coding an interval.
 */
export const REMINDER_LEAD_MINUTES = 15;

export function reminderFiresAt(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() - REMINDER_LEAD_MINUTES * 60 * 1000);
}

/** A schedule within this many minutes of "now" is considered starting soon / live. */
export const LIVE_STATUS_SYNC_WINDOW_MINUTES = 30;

/** A schedule this many minutes past its start with no live session is a no-show. */
export const NO_SHOW_GRACE_MINUTES = 30;
