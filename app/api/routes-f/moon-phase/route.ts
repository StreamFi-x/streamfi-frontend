import { NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

/**
 * Mean length of a synodic month (one new-moon-to-new-moon cycle), in days.
 * Source: Jean Meeus, "Astronomical Algorithms" (2nd ed.), the mean synodic
 * month is 29.530588853 days. We use the commonly cited 29.53058867 value.
 */
export const SYNODIC_MONTH = 29.53058867;

/**
 * A well-documented reference new moon: 2000-01-06 18:14 UTC. Lunar age for any
 * other instant is the elapsed time since this epoch reduced modulo the synodic
 * month. This is the standard "synodic-month approximation" — it ignores the
 * small irregularities in the Moon's orbit and is accurate to within ~1 day.
 */
export const REFERENCE_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);

/**
 * The eight conventional moon phases, ordered from new moon through a full
 * cycle. The four "principal" phases (new, first quarter, full, last quarter)
 * sit at exact 1/4 points; the four intermediate phases fill the gaps.
 */
export const PHASE_NAMES = [
  "new",
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "full",
  "waning gibbous",
  "last quarter",
  "waning crescent",
] as const;

export type PhaseName = (typeof PHASE_NAMES)[number];

export interface MoonPhaseResult {
  phase_name: PhaseName;
  illumination_percent: number;
  age_days: number;
}

/**
 * Compute the moon phase for the given UTC instant.
 *
 * `age_days` is the time elapsed since the most recent new moon (0 .. synodic
 * month). `illumination_percent` is the fraction of the lunar disc that appears
 * lit, derived from the age via (1 - cos(2π·age/synodic)) / 2. `phase_name` is
 * the nearest of the eight conventional phases, so each principal phase is
 * centred on its exact age.
 */
export function moonPhaseAt(date: Date): MoonPhaseResult {
  const elapsedDays = (date.getTime() - REFERENCE_NEW_MOON_UTC) / 86_400_000;

  // Reduce into [0, SYNODIC_MONTH). `%` keeps the sign of the dividend, so add
  // a synodic month before the final modulo to handle dates before the epoch.
  const ageDays =
    ((elapsedDays % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;

  const cyclePosition = ageDays / SYNODIC_MONTH; // 0 .. 1
  const illumination = (1 - Math.cos(2 * Math.PI * cyclePosition)) / 2;

  // Round to the nearest eighth so principal phases occupy a narrow window
  // centred on their exact age; `% 8` folds the wrap-around back onto "new".
  const phaseIndex = Math.round(cyclePosition * 8) % 8;

  return {
    phase_name: PHASE_NAMES[phaseIndex],
    illumination_percent: Math.round(illumination * 1000) / 10,
    age_days: Math.round(ageDays * 100) / 100,
  };
}

/**
 * Parse a strict `YYYY-MM-DD` string as a UTC midnight instant, returning
 * `null` for impossible calendar dates. `new Date(...)` silently rolls
 * overflowing days into the next month (e.g. "2024-02-30" → Mar 1), so we
 * verify the parsed components round-trip back to the input.
 */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const result = validateQuery(searchParams, schema);
  if (result instanceof NextResponse) {
    return result;
  }

  const date = parseCalendarDate(result.data.date);
  if (!date) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: "date is not a real calendar date",
      },
      { status: 400 }
    );
  }

  return NextResponse.json(moonPhaseAt(date));
}
