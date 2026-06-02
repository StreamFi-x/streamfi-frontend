import { type NextRequest, NextResponse } from "next/server";
import { COUNTRY_ALIASES, HOLIDAYS, type HolidayCountry } from "./holidays";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type BusinessDaysBody = {
  date?: unknown;
  days?: unknown;
  country?: unknown;
  custom_holidays?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * MS_PER_DAY);
}

function resolveCountry(value: unknown): HolidayCountry {
  if (typeof value !== "string") {
    return "US";
  }

  const normalized = value.toUpperCase();
  if (normalized in HOLIDAYS) {
    return normalized as HolidayCountry;
  }

  if (normalized in COUNTRY_ALIASES) {
    return COUNTRY_ALIASES[normalized];
  }

  return "US";
}

function parseCustomHolidays(value: unknown): Set<string> | null {
  if (value === undefined) {
    return new Set();
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const result = new Set<string>();
  for (const item of value) {
    const date = parseIsoDate(item);
    if (!date) {
      return null;
    }
    result.add(dateKey(date));
  }
  return result;
}

function addBusinessDays(
  startDate: Date,
  days: number,
  holidays: Set<string>
): { target: Date; skipped: number } {
  if (days === 0) {
    return { target: startDate, skipped: 0 };
  }

  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  let current = startDate;
  let skipped = 0;

  while (remaining > 0) {
    current = addDays(current, step);
    if (isWeekend(current) || holidays.has(dateKey(current))) {
      skipped += 1;
      continue;
    }
    remaining -= 1;
  }

  return { target: current, skipped };
}

export async function POST(request: NextRequest) {
  let body: BusinessDaysBody;

  try {
    body = (await request.json()) as BusinessDaysBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const date = parseIsoDate(body.date);
  if (!date) {
    return badRequest("date must be a valid ISO date string.");
  }

  if (typeof body.days !== "number" || !Number.isInteger(body.days)) {
    return badRequest("days must be an integer.");
  }

  const country = resolveCountry(body.country);
  const holidays = new Set(HOLIDAYS[country].map((holiday) => holiday.date));
  const customHolidays = parseCustomHolidays(body.custom_holidays);
  if (customHolidays === null) {
    return badRequest("custom_holidays must be an array of ISO date strings.");
  }

  for (const holiday of customHolidays) {
    holidays.add(holiday);
  }

  const { target, skipped } = addBusinessDays(date, body.days, holidays);
  return NextResponse.json({ result: target.toISOString(), skipped_days: skipped });
}
