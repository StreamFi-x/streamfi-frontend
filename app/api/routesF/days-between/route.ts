import { type NextRequest, NextResponse } from "next/server";

type Holiday = {
  date: string;
  name: string;
};

const HOLIDAYS: Record<string, Holiday[]> = {
  US: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-01-19", name: "Martin Luther King Jr. Day" },
    { date: "2026-02-16", name: "Presidents' Day" },
    { date: "2026-05-25", name: "Memorial Day" },
    { date: "2026-06-19", name: "Juneteenth" },
    { date: "2026-07-03", name: "Independence Day observed" },
    { date: "2026-09-07", name: "Labor Day" },
    { date: "2026-10-12", name: "Columbus Day" },
    { date: "2026-11-11", name: "Veterans Day" },
    { date: "2026-11-26", name: "Thanksgiving Day" },
    { date: "2026-12-25", name: "Christmas Day" },
  ],
  NG: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-03-20", name: "Eid al-Fitr" },
    { date: "2026-03-21", name: "Eid al-Fitr Holiday" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-05-01", name: "Workers' Day" },
    { date: "2026-05-27", name: "Eid al-Adha" },
    { date: "2026-06-12", name: "Democracy Day" },
    { date: "2026-10-01", name: "Independence Day" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-26", name: "Boxing Day" },
  ],
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export async function POST(req: NextRequest) {
  let body: { from?: unknown; to?: unknown; country?: unknown };

  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const from = parseIsoDate(body.from);
  const to = parseIsoDate(body.to);
  if (!from || !to) {
    return badRequest("from and to must be valid ISO date strings.");
  }

  const country =
    typeof body.country === "string" ? body.country.toUpperCase() : "US";
  const holidays = HOLIDAYS[country] ?? HOLIDAYS.US;
  const holidayMap = new Map(holidays.map(holiday => [holiday.date, holiday]));

  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const calendarDays = Math.round(
    (end.getTime() - start.getTime()) / MS_PER_DAY
  );
  let weekends = 0;
  let businessDays = 0;
  const holidaysInRange: Holiday[] = [];

  for (let offset = 0; offset < calendarDays; offset += 1) {
    const current = addDays(start, offset);
    const key = dateKey(current);
    const weekend = isWeekend(current);
    const holiday = holidayMap.get(key);

    if (weekend) {
      weekends += 1;
    }
    if (holiday) {
      holidaysInRange.push(holiday);
    }
    if (!weekend && !holiday) {
      businessDays += 1;
    }
  }

  return NextResponse.json({
    calendar_days: calendarDays,
    business_days: businessDays,
    weekends,
    holidays_in_range: holidaysInRange,
  });
}
