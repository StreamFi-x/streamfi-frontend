import type { DateBreakdown, DateDiffUnit } from "./types";

const EXPLICIT_ZONE_SUFFIX = /(z|[+-]\d{2}:?\d{2})$/i;
const ISO_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[tT ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

const ALLOWED_UNITS = new Set([
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "all",
]);

type ParsedLocal = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function daysInMonthUtc(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addYearsUtc(date: Date, years: number): Date {
  const year = date.getUTCFullYear() + years;
  const month = date.getUTCMonth();
  const day = Math.min(date.getUTCDate(), daysInMonthUtc(year, month));

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

function addMonthsUtc(date: Date, months: number): Date {
  const totalMonths = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), daysInMonthUtc(year, month));

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

function parseLocalIso(input: string): ParsedLocal | null {
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
  const millisecond = match[7] ? Number(match[7].padEnd(3, "0")) : 0;

  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, hour, minute, second, millisecond };
}

export function parseIsoToDate(input: string): Date | null {
  const trimmed = input.trim();

  if (EXPLICIT_ZONE_SUFFIX.test(trimmed)) {
    const zoned = new Date(trimmed);
    return Number.isNaN(zoned.getTime()) ? null : zoned;
  }

  const local = parseLocalIso(trimmed);
  if (!local) {
    return null;
  }

  return new Date(
    Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
      local.millisecond
    )
  );
}

export function isValidUnit(unit: unknown): unit is DateDiffUnit {
  return typeof unit === "string" && ALLOWED_UNITS.has(unit);
}

export function buildCalendarBreakdown(from: Date, to: Date): DateBreakdown {
  const forward = from.getTime() <= to.getTime();
  const start = forward ? from : to;
  const end = forward ? to : from;

  let cursor = new Date(start.getTime());
  let years = 0;
  while (addYearsUtc(cursor, 1).getTime() <= end.getTime()) {
    years += 1;
    cursor = addYearsUtc(cursor, 1);
  }

  let months = 0;
  while (addMonthsUtc(cursor, 1).getTime() <= end.getTime()) {
    months += 1;
    cursor = addMonthsUtc(cursor, 1);
  }

  const remainingMs = end.getTime() - cursor.getTime();
  const days = Math.floor(remainingMs / 86_400_000);
  const hours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);

  const sign = forward ? 1 : -1;

  return {
    years: years * sign,
    months: months * sign,
    days: days * sign,
    hours: hours * sign,
    minutes: minutes * sign,
  };
}

function plural(value: number, unit: string): string {
  const abs = Math.abs(value);
  return `${abs} ${unit}${abs === 1 ? "" : "s"}`;
}

export function formatHuman(
  breakdown: DateBreakdown,
  totalSeconds: number,
  unit: DateDiffUnit = "all"
): string {
  if (totalSeconds === 0) {
    return "now";
  }

  if (unit !== "all") {
    const map = {
      years: totalSeconds / (365.2425 * 24 * 3600),
      months: totalSeconds / (30.436875 * 24 * 3600),
      weeks: totalSeconds / (7 * 24 * 3600),
      days: totalSeconds / (24 * 3600),
      hours: totalSeconds / 3600,
      minutes: totalSeconds / 60,
    } as const;

    const value = Math.trunc(map[unit]);
    const phrase = plural(value, unit.slice(0, -1));
    return value < 0 ? `${phrase} ago` : `in ${phrase}`;
  }

  const ordered: Array<[string, number]> = [
    ["year", breakdown.years],
    ["month", breakdown.months],
    ["day", breakdown.days],
    ["hour", breakdown.hours],
    ["minute", breakdown.minutes],
  ];

  const parts = ordered
    .filter(([, value]) => value !== 0)
    .slice(0, 3)
    .map(([label, value]) => plural(value, label));

  const phrase = parts.length > 0 ? parts.join(", ") : "0 minutes";
  return totalSeconds < 0 ? `${phrase} ago` : `in ${phrase}`;
}
