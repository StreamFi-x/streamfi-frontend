import type { TimeParts } from "./types";

const EXPLICIT_ZONE_SUFFIX = /(z|[+-]\d{2}:?\d{2})$/i;

const ISO_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[tT ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

const TZ_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = TZ_FORMATTER_CACHE.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  TZ_FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

function parseLocalIso(input: string): TimeParts | null {
  const match = input.match(ISO_LOCAL_PATTERN);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;
  const second = match[6] ? Number(match[6]) : 0;
  const ms = match[7] ? Number(match[7].padEnd(3, "0")) : 0;

  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, ms)
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, hour, minute, second, millisecond: ms };
}

function partsForDate(date: Date, timeZone: string): TimeParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const partMap = new Map(parts.map(part => [part.type, part.value]));

  return {
    year: Number(partMap.get("year")),
    month: Number(partMap.get("month")),
    day: Number(partMap.get("day")),
    hour: Number(partMap.get("hour")),
    minute: Number(partMap.get("minute")),
    second: Number(partMap.get("second")),
    millisecond: date.getUTCMilliseconds(),
  };
}

function toUtcComparable(parts: TimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );
}

function localPartsToEpochMs(
  localParts: TimeParts,
  fromTimeZone: string
): number | null {
  let guess = toUtcComparable(localParts);

  for (let i = 0; i < 6; i += 1) {
    const zoned = partsForDate(new Date(guess), fromTimeZone);
    const delta = toUtcComparable(localParts) - toUtcComparable(zoned);
    guess += delta;

    if (delta === 0) {
      const verify = partsForDate(new Date(guess), fromTimeZone);
      if (
        verify.year === localParts.year &&
        verify.month === localParts.month &&
        verify.day === localParts.day &&
        verify.hour === localParts.hour &&
        verify.minute === localParts.minute &&
        verify.second === localParts.second
      ) {
        return guess;
      }
      return null;
    }
  }

  return null;
}

export function isValidTimeZone(tz: string): boolean {
  return VALID_TIMEZONES.has(tz);
}

export function parseTimestampToInstant(
  timestamp: string,
  fromTimeZone: string
): Date | null {
  if (EXPLICIT_ZONE_SUFFIX.test(timestamp)) {
    const withZone = new Date(timestamp);
    return Number.isNaN(withZone.getTime()) ? null : withZone;
  }

  const localParts = parseLocalIso(timestamp);
  if (!localParts) {
    return null;
  }

  const utcMs = localPartsToEpochMs(localParts, fromTimeZone);
  if (utcMs === null) {
    return null;
  }

  return new Date(utcMs);
}

function offsetMinutesAt(date: Date, timeZone: string): number {
  const zoned = partsForDate(date, timeZone);
  const zonedAsUtc = toUtcComparable(zoned);
  return Math.round((zonedAsUtc - date.getTime()) / 60_000);
}

function offsetString(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

export function toZonedOutput(
  date: Date,
  toTimeZone: string
): { converted: string; offset_hours: number } {
  const parts = partsForDate(date, toTimeZone);
  const offsetMin = offsetMinutesAt(date, toTimeZone);

  const converted = `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(
    2,
    "0"
  )}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(
    parts.second
  ).padStart(2, "0")}${offsetString(offsetMin)}`;

  return {
    converted,
    offset_hours: Math.round((offsetMin / 60 + Number.EPSILON) * 100) / 100,
  };
}
