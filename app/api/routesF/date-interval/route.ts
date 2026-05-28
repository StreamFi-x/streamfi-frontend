import { type NextRequest, NextResponse } from "next/server";
import { addIntervalsToDate, type IntervalDelta } from "./calendar";

type DateIntervalBody = {
  date?: unknown;
  add?: unknown;
};

function isIntervalDelta(value: unknown): value is IntervalDelta {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = ["years", "months", "days", "hours", "minutes"] as const;

  if (Object.keys(record).length === 0) {
    return false;
  }

  return Object.keys(record).every((key) => keys.includes(key as (typeof keys)[number])) &&
    keys.every((key) => record[key] === undefined || Number.isInteger(record[key]));
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: DateIntervalBody;

  try {
    body = (await req.json()) as DateIntervalBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  if (typeof body.date !== "string") {
    return badRequest("date must be an ISO date string.");
  }

  if (!isIntervalDelta(body.add)) {
    return badRequest("add must be an object with integer years, months, days, hours, and/or minutes.");
  }

  try {
    const result = addIntervalsToDate(body.date, body.add);
    return NextResponse.json({ result });
  } catch {
    return badRequest("date must be a valid ISO date string.");
  }
}
