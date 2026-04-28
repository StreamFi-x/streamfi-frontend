import { NextResponse } from "next/server";
import { calculateWorkdays } from "./_lib/workdays";
import { WorkdaysRequest } from "./types";

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as Partial<WorkdaysRequest>;

  const { from, to, country, custom_holidays, weekend_days } = payload;

  if (typeof from !== "string" || typeof to !== "string") {
    return NextResponse.json(
      { error: "from and to must be strings" },
      { status: 400 }
    );
  }

  let fromDate: Date;
  let toDate: Date;

  try {
    fromDate = new Date(from);
    toDate = new Date(to);
  } catch {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  if (fromDate > toDate) {
    return NextResponse.json(
      { error: "from date must be before or equal to to date" },
      { status: 400 }
    );
  }

  if (country !== undefined && typeof country !== "string") {
    return NextResponse.json(
      { error: "country must be a string" },
      { status: 400 }
    );
  }

  if (custom_holidays !== undefined && !Array.isArray(custom_holidays)) {
    return NextResponse.json(
      { error: "custom_holidays must be an array of strings" },
      { status: 400 }
    );
  }

  if (weekend_days !== undefined && !Array.isArray(weekend_days)) {
    return NextResponse.json(
      { error: "weekend_days must be an array of numbers" },
      { status: 400 }
    );
  }

  const customHols = custom_holidays
    ? custom_holidays.filter((h): h is string => typeof h === "string")
    : [];
  const weekendD = weekend_days
    ? weekend_days.filter(
        (d): d is number => typeof d === "number" && d >= 0 && d <= 6
      )
    : [0, 6];

  try {
    const result = calculateWorkdays(
      fromDate,
      toDate,
      country,
      customHols,
      weekendD
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to calculate workdays";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
