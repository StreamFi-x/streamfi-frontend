/**
 * Types for GET/PUT /api/routes-f/channel-weekly-schedule
 */

/** 0 = Sunday … 6 = Saturday (matches JS Date.getDay()) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ScheduleSlot {
  /** Day of week: 0 (Sun) – 6 (Sat) */
  day_of_week: DayOfWeek;
  /** Wall-clock start time in HH:MM (24-hour) format */
  start_time: string;
  /** Stream duration in minutes (min 15, max 720) */
  duration_minutes: number;
  /** Optional stream title for this recurring slot */
  title?: string;
}

export interface ChannelSchedule {
  creator_id: string;
  slots: ScheduleSlot[];
  updated_at: string;
}

export interface ScheduleResponse {
  creator_id: string;
  schedule: ScheduleSlot[];
  updated_at: string;
}
