import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

/** Hard cap on the number of dates returned, regardless of `count`/`until`. */
export const MAX_DATES = 1000;

export interface RecurrenceRule {
  start: Date;
  frequency: Frequency;
  interval: number;
  count?: number;
  until?: Date;
}

export interface RecurrenceResult {
  dates: string[];
  count: number;
}

/**
 * Add whole calendar months to a UTC instant, clamping the day-of-month to the
 * last valid day of the target month (Jan 31 + 1 month → Feb 28/29). The day is
 * always taken from the original `start`, so anchoring is preserved across the
 * series: Jan 31 yields Feb 29, Mar 31, Apr 30, ... rather than drifting.
 */
function addMonths(start: Date, months: number): Date {
  const year = start.getUTCFullYear();
  const monthIndex = start.getUTCMonth() + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;

  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const day = Math.min(start.getUTCDate(), daysInTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds()
    )
  );
}

/**
 * Compute the n-th occurrence (0-based; occurrence 0 is `start` itself) for a
 * recurrence rule. Each occurrence is derived from `start` directly rather than
 * from the previous one, which avoids accumulated drift and keeps month/year
 * day-of-month anchoring correct.
 */
function occurrence(
  start: Date,
  n: number,
  frequency: Frequency,
  interval: number
): Date {
  const step = n * interval;
  switch (frequency) {
    case "daily":
      return new Date(start.getTime() + step * 86_400_000);
    case "weekly":
      return new Date(start.getTime() + step * 7 * 86_400_000);
    case "monthly":
      return addMonths(start, step);
    case "yearly":
      return addMonths(start, step * 12);
  }
}

/**
 * Expand a recurrence rule into an ordered list of ISO-8601 instants. The
 * series always begins at `start`. Generation stops at whichever limit is
 * reached first: `count` occurrences, the last occurrence on or before `until`,
 * or the {@link MAX_DATES} hard cap.
 */
export function generateSeries(rule: RecurrenceRule): RecurrenceResult {
  const { start, frequency, interval, count, until } = rule;

  const limit = count !== undefined ? Math.min(count, MAX_DATES) : MAX_DATES;
  const untilTime = until?.getTime();

  const dates: string[] = [];
  for (let n = 0; dates.length < limit; n++) {
    const occ = occurrence(start, n, frequency, interval);
    if (untilTime !== undefined && occ.getTime() > untilTime) {
      break;
    }
    dates.push(occ.toISOString());
  }

  return { dates, count: dates.length };
}

const isoDate = z
  .string()
  .refine(
    value => !Number.isNaN(new Date(value).getTime()),
    "must be a valid ISO date"
  );

const schema = z
  .object({
    start: isoDate,
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().int().positive().optional().default(1),
    count: z.number().int().positive().optional(),
    until: isoDate.optional(),
  })
  .refine(
    rule =>
      rule.until === undefined ||
      new Date(rule.until).getTime() >= new Date(rule.start).getTime(),
    { message: "until must be on or after start", path: ["until"] }
  );

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) {
    return result;
  }

  const { start, frequency, interval, count, until } = result.data;

  return NextResponse.json(
    generateSeries({
      start: new Date(start),
      frequency,
      interval,
      count,
      until: until ? new Date(until) : undefined,
    })
  );
}
