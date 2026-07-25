import type { StreamRecord, DayPerformance } from "./types";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Output order starts on Monday, matching a typical weekly schedule view.
export const WEEKDAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function getWeekdayName(isoDate: string): string {
  return WEEKDAY_NAMES[new Date(isoDate).getUTCDay()];
}

// Always returns all 7 weekdays, in WEEKDAY_ORDER, with zeroed stats for
// days with no streams — so consumers can render a full week grid.
export function computeDayPerformance(streams: StreamRecord[]): DayPerformance[] {
  const byDay = new Map<string, StreamRecord[]>();
  for (const day of WEEKDAY_ORDER) {
    byDay.set(day, []);
  }
  for (const stream of streams) {
    const day = getWeekdayName(stream.date);
    byDay.get(day)?.push(stream);
  }

  return WEEKDAY_ORDER.map(day => {
    const dayStreams = byDay.get(day) ?? [];
    const stream_count = dayStreams.length;
    const avg_viewers =
      stream_count === 0
        ? 0
        : roundToTwo(
            dayStreams.reduce((sum, s) => sum + s.viewer_count, 0) /
              stream_count
          );
    const avg_tips_usdc =
      stream_count === 0
        ? 0
        : roundToTwo(
            dayStreams.reduce((sum, s) => sum + s.tips_usdc, 0) / stream_count
          );

    return { day, avg_viewers, avg_tips_usdc, stream_count };
  });
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
