import type { ChatEvent, ChatVelocityResponse, MinuteSeriesPoint } from "./types";

const SECONDS_PER_MINUTE = 60;

/**
 * Bucket chat events into per-minute counts. minute_offset 0 covers [0, 60s),
 * minute_offset 1 covers [60, 120s), and so on.
 */
export function bucketByMinute(events: ChatEvent[]): MinuteSeriesPoint[] {
  if (events.length === 0) {
    return [];
  }

  const counts = new Map<number, number>();
  for (const event of events) {
    const minute = Math.floor(event.offset_seconds / SECONDS_PER_MINUTE);
    counts.set(minute, (counts.get(minute) ?? 0) + 1);
  }

  const maxMinute = Math.max(...counts.keys());
  const series: MinuteSeriesPoint[] = [];
  for (let minute = 0; minute <= maxMinute; minute++) {
    series.push({
      minute_offset: minute,
      messages: counts.get(minute) ?? 0,
    });
  }
  return series;
}

export function findPeakMinute(series: MinuteSeriesPoint[]): number {
  if (series.length === 0) {
    return 0;
  }
  let peakMinute = series[0].minute_offset;
  let peakCount = series[0].messages;
  for (const point of series) {
    if (point.messages > peakCount) {
      peakCount = point.messages;
      peakMinute = point.minute_offset;
    }
  }
  return peakMinute;
}

export function computeVelocity(events: ChatEvent[]): ChatVelocityResponse {
  const series = bucketByMinute(events);
  return {
    series,
    peak_minute: findPeakMinute(series),
    total_messages: events.length,
  };
}
