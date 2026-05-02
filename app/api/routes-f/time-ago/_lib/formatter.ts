import type { TimeStyle, TimeAgoResponse } from "./types";

const THRESHOLDS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 365 * 86400 },
  { unit: "month", seconds: 30 * 86400 },
  { unit: "week", seconds: 7 * 86400 },
  { unit: "day", seconds: 86400 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function formatTimeAgo(
  timestamp: number | string,
  nowArg?: number | string,
  style: TimeStyle = "long",
  locale: string = "en-US"
): TimeAgoResponse {
  const ts = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
  const now =
    nowArg !== undefined
      ? typeof nowArg === "string"
        ? new Date(nowArg).getTime()
        : nowArg
      : Date.now();

  const diffMs = ts - now;
  const seconds_diff = Math.round(diffMs / 1000);
  const is_future = diffMs > 0;
  const absDiff = Math.abs(seconds_diff);

  const rtf = new Intl.RelativeTimeFormat(locale, { style, numeric: "auto" });

  const threshold = THRESHOLDS.find((t) => absDiff >= t.seconds) ?? THRESHOLDS[THRESHOLDS.length - 1];
  const value = Math.round(seconds_diff / threshold.seconds);
  const ago = rtf.format(value, threshold.unit);

  return { ago, seconds_diff, is_future };
}
