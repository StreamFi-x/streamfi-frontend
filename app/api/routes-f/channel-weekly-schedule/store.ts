import type { ChannelSchedule } from "./types";

/**
 * In-memory store keyed by creator_id.
 * Exported so tests can reset between runs.
 */
export const scheduleStore = new Map<string, ChannelSchedule>();

/** Seed data — two creators with pre-existing schedules */
const SEED: ChannelSchedule[] = [
  {
    creator_id: "creator_001",
    slots: [
      { day_of_week: 1, start_time: "18:00", duration_minutes: 120, title: "Monday Night Stellar Dev" },
      { day_of_week: 3, start_time: "20:00", duration_minutes: 90,  title: "Mid-week DeFi Talk" },
      { day_of_week: 6, start_time: "15:00", duration_minutes: 180, title: "Weekend Marathon" },
    ],
    updated_at: "2026-06-20T10:00:00Z",
  },
  {
    creator_id: "creator_002",
    slots: [
      { day_of_week: 5, start_time: "21:00", duration_minutes: 60 },
    ],
    updated_at: "2026-06-18T14:30:00Z",
  },
];

// Populate store with seed data on module load
for (const entry of SEED) {
  scheduleStore.set(entry.creator_id, { ...entry, slots: entry.slots.map((s) => ({ ...s })) });
}

export function resetStore(): void {
  scheduleStore.clear();
  for (const entry of SEED) {
    scheduleStore.set(entry.creator_id, { ...entry, slots: entry.slots.map((s) => ({ ...s })) });
  }
}
