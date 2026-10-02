import type { ScheduledReminder } from "./types";

/**
 * Seed reminders. `fires_at` values are relative to a fixed reference point
 * (2026-08-28T12:00:00Z) rather than wall-clock "now" — tests pin the clock
 * to that same instant via jest.useFakeTimers so the next-hour-bucket
 * boundary is deterministic regardless of when the suite actually runs.
 */
const REFERENCE_NOW = "2026-08-28T12:00:00Z";

const SEED: ScheduledReminder[] = [
  {
    id: "rem_past_due",
    viewer_id: "viewer_001",
    stream_id: "stream_a",
    fires_at: "2026-08-28T11:30:00Z", // 30 min before reference — already past
    dispatched: false,
    dispatched_at: null,
  },
  {
    id: "rem_in_bucket_1",
    viewer_id: "viewer_001",
    stream_id: "stream_b",
    fires_at: "2026-08-28T12:15:00Z", // 15 min after reference — in the next hour
    dispatched: false,
    dispatched_at: null,
  },
  {
    id: "rem_in_bucket_2",
    viewer_id: "viewer_002",
    stream_id: "stream_c",
    fires_at: "2026-08-28T12:59:00Z", // 59 min after — still in the next hour
    dispatched: false,
    dispatched_at: null,
  },
  {
    id: "rem_beyond_bucket",
    viewer_id: "viewer_002",
    stream_id: "stream_d",
    fires_at: "2026-08-28T13:05:00Z", // just past the 1-hour window
    dispatched: false,
    dispatched_at: null,
  },
  {
    id: "rem_already_dispatched",
    viewer_id: "viewer_001",
    stream_id: "stream_e",
    fires_at: "2026-08-28T12:30:00Z", // in-window, but already sent
    dispatched: true,
    dispatched_at: "2026-08-28T11:00:00Z",
  },
];

let _store: ScheduledReminder[] = SEED.map((r) => ({ ...r }));

export function getStore(): ScheduledReminder[] {
  return _store;
}

export function resetStore(): void {
  _store = SEED.map((r) => ({ ...r }));
}

export { REFERENCE_NOW };
