import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  birthdate: z.string().datetime({ offset: true }).or(z.string().date()),
  on_date: z
    .string()
    .datetime({ offset: true })
    .or(z.string().date())
    .optional(),
});

function parseDate(value: string): Date {
  return new Date(value);
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function getCompletedYears(birthdate: Date, onDate: Date): number {
  let years = onDate.getUTCFullYear() - birthdate.getUTCFullYear();
  const birthMonth = birthdate.getUTCMonth();
  const currentMonth = onDate.getUTCMonth();

  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth &&
      onDate.getUTCDate() < birthdate.getUTCDate())
  ) {
    years -= 1;
  }

  return years;
}

function getCompletedMonths(birthdate: Date, onDate: Date): number {
  let months =
    (onDate.getUTCFullYear() - birthdate.getUTCFullYear()) * 12 +
    (onDate.getUTCMonth() - birthdate.getUTCMonth());

  if (onDate.getUTCDate() < birthdate.getUTCDate()) {
    months -= 1;
  }

  return months;
}

export async function POST(req: NextRequest) {
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map(issue => ({
          field: issue.path.join(".") || "body",
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const birthdate = parseDate(parsed.data.birthdate);
  const onDate = parseDate(parsed.data.on_date ?? new Date().toISOString());

  if (!isValidDate(birthdate) || !isValidDate(onDate)) {
    return NextResponse.json({ error: "Invalid date input" }, { status: 400 });
  }

  if (birthdate > onDate) {
    return NextResponse.json(
      { error: "birthdate cannot be in the future" },
      { status: 400 }
    );
  }

  const diffMs = onDate.getTime() - birthdate.getTime();
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.floor(totalDays / 7);

  return NextResponse.json({
    years: getCompletedYears(birthdate, onDate),
    total_months: getCompletedMonths(birthdate, onDate),
    total_weeks: totalWeeks,
    total_days: totalDays,
    total_hours: totalHours,
  });
}
