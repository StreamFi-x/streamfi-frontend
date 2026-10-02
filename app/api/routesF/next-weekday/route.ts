import { NextRequest, NextResponse } from "next/server";

type NextWeekdayBody = {
  weekday?: unknown;
  from?: unknown;
  include_today?: unknown;
};

const WEEKDAY_LOOKUP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseWeekday(value: unknown) {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 6
  ) {
    return value;
  }

  if (typeof value === "string") {
    return WEEKDAY_LOOKUP[value.trim().toLowerCase()];
  }

  return undefined;
}

function parseFromDate(value: unknown) {
  if (value === undefined) {
    return new Date();
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export async function POST(req: NextRequest) {
  let body: NextWeekdayBody;

  try {
    body = (await req.json()) as NextWeekdayBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const targetWeekday = parseWeekday(body.weekday);
  if (targetWeekday === undefined) {
    return badRequest("weekday must be a number from 0-6 or a weekday name.");
  }

  if (
    body.include_today !== undefined &&
    typeof body.include_today !== "boolean"
  ) {
    return badRequest("include_today must be a boolean when provided.");
  }

  const fromDate = parseFromDate(body.from);
  if (fromDate === null) {
    return badRequest("from must be a valid ISO date string.");
  }

  const includeToday = body.include_today === true;
  const normalizedFrom = startOfUtcDay(fromDate);
  const currentWeekday = normalizedFrom.getUTCDay();
  let daysUntil = (targetWeekday - currentWeekday + 7) % 7;

  if (daysUntil === 0 && !includeToday) {
    daysUntil = 7;
  }

  const result = new Date(normalizedFrom);
  result.setUTCDate(result.getUTCDate() + daysUntil);

  return NextResponse.json({
    date: result.toISOString(),
    days_until: daysUntil,
  });
}
