/**
 * Stream schedule lifecycle and recurrence (#1428).
 *
 * scheduled_at is always stored as a canonical UTC instant (TIMESTAMPTZ);
 * `timezone` is the creator's IANA zone, used only to render wall-clock time
 * and to compute the next weekly occurrence in the creator's own calendar
 * sense. Storing a naive local datetime as the canonical value is exactly the
 * bug this schema avoids.
 */
import {
  LIVE_STATUS_SYNC_WINDOW_MINUTES,
  NO_SHOW_GRACE_MINUTES,
} from "./reminder-policy";

export type ScheduleStatus =
  | "upcoming"
  | "live"
  | "completed"
  | "cancelled"
  | "missed";

export type Recurrence = "none" | "weekly";

export const RECURRENCE_VALUES: readonly Recurrence[] = ["none", "weekly"];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The next occurrence's instant for a weekly-recurring schedule. */
export function nextWeeklyOccurrence(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() + WEEK_MS);
}

export interface ScheduleTimingInput {
  scheduledAt: Date;
  durationMins: number;
  status: ScheduleStatus;
  now?: Date;
}

/**
 * Whether a schedule that never went live should be marked a no-show.
 * A creator starting early or late relative to the announced time is not a
 * no-show — only silence past scheduled_at + duration + grace is.
 */
export function isNoShow(input: ScheduleTimingInput): boolean {
  if (input.status !== "upcoming") {
    return false;
  }
  const now = input.now ?? new Date();
  const deadline = new Date(
    input.scheduledAt.getTime() +
      input.durationMins * 60 * 1000 +
      NO_SHOW_GRACE_MINUTES * 60 * 1000
  );
  return now.getTime() > deadline.getTime();
}

/** Whether a schedule is close enough to its start to flip to "live" once the creator goes live. */
export function isWithinLiveSyncWindow(
  scheduledAt: Date,
  now: Date = new Date()
): boolean {
  const diffMs = Math.abs(scheduledAt.getTime() - now.getTime());
  return diffMs <= LIVE_STATUS_SYNC_WINDOW_MINUTES * 60 * 1000;
}

/** Valid status transitions. Anything not listed here is rejected server-side. */
const ALLOWED_TRANSITIONS: Record<ScheduleStatus, ScheduleStatus[]> = {
  upcoming: ["live", "cancelled", "missed"],
  live: ["completed"],
  completed: [],
  cancelled: [],
  missed: [],
};

export function canTransition(
  from: ScheduleStatus,
  to: ScheduleStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
