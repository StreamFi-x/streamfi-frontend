import { NextRequest, NextResponse } from "next/server";

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getNextLeapYears(from: number, count = 5): number[] {
  const result: number[] = [];
  let y = from + 1;
  while (result.length < count) {
    if (isLeapYear(y)) {result.push(y);}
    y++;
  }
  return result;
}

function leapReason(year: number): string {
  if (year % 400 === 0) {return "Divisible by 400";}
  if (year % 100 === 0) {return "Divisible by 100 but not 400 — not a leap year";}
  if (year % 4 === 0) {return "Divisible by 4 but not 100";}
  return "Not divisible by 4";
}

export async function GET(req: NextRequest) {
  const yearParam = new URL(req.url).searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : NaN;

  if (!yearParam || isNaN(year)) {
    return NextResponse.json({ error: "year query param is required" }, { status: 400 });
  }

  return NextResponse.json({
    is_leap: isLeapYear(year),
    reason: leapReason(year),
    next_leap_years: getNextLeapYears(year),
  });
}
