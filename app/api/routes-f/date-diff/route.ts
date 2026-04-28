import { NextRequest, NextResponse } from "next/server";
import {
  buildCalendarBreakdown,
  formatHuman,
  isValidUnit,
  parseIsoToDate,
} from "./_lib/helpers";
import type { DateDiffRequest, DateDiffResponse } from "./_lib/types";
export async function POST(req: NextRequest) {
  let body: DateDiffRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body?.from !== "string" || typeof body?.to !== "string") {
    return NextResponse.json(
      { error: "from and to must be ISO date strings." },
      { status: 400 }
    );
  }
  const unit = body.unit ?? "all";
  if (!isValidUnit(unit)) {
    return NextResponse.json(
      {
        error:
          "unit must be one of years, months, weeks, days, hours, minutes, all.",
      },
      { status: 400 }
    );
  }
  const fromDate = parseIsoToDate(body.from);
  const toDate = parseIsoToDate(body.to);
  if (!fromDate || !toDate) {
    return NextResponse.json(
      { error: "Invalid ISO timestamp input." },
      { status: 400 }
    );
  }
  const totalSeconds = Math.trunc(
    (toDate.getTime() - fromDate.getTime()) / 1000
  );
  const breakdown = buildCalendarBreakdown(fromDate, toDate);
  const response: DateDiffResponse = {
    from: body.from,
    to: body.to,
    breakdown,
    total_seconds: totalSeconds,
    human: formatHuman(breakdown, totalSeconds, unit),
  };
  return NextResponse.json(response);
}
