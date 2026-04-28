import { NextRequest, NextResponse } from "next/server";
import {
  isValidTimeZone,
  parseTimestampToInstant,
  toZonedOutput,
} from "./_lib/helpers";
import type { TimezoneResponse } from "./_lib/types";
export async function GET(req: NextRequest) {
  const timestamp = req.nextUrl.searchParams.get("timestamp");
  const from = req.nextUrl.searchParams.get("from") ?? "UTC";
  const to = req.nextUrl.searchParams.get("to");
  if (!timestamp) {
    return NextResponse.json(
      { error: "timestamp query parameter is required." },
      { status: 400 }
    );
  }
  if (!to) {
    return NextResponse.json(
      { error: "to query parameter is required." },
      { status: 400 }
    );
  }
  if (!isValidTimeZone(from) || !isValidTimeZone(to)) {
    return NextResponse.json(
      { error: "Invalid timezone name." },
      { status: 400 }
    );
  }
  const instant = parseTimestampToInstant(timestamp, from);
  if (!instant) {
    return NextResponse.json(
      { error: "Invalid timestamp for provided timezone context." },
      { status: 400 }
    );
  }
  const response: TimezoneResponse = toZonedOutput(instant, to);
  return NextResponse.json(response);
}
