import { NextRequest, NextResponse } from "next/server";

type Style = "long" | "short" | "narrow";

const THRESHOLDS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "second", seconds: 60 },
  { unit: "minute", seconds: 3600 },
  { unit: "hour", seconds: 86400 },
  { unit: "day", seconds: 604800 },
  { unit: "week", seconds: 2592000 },
  { unit: "month", seconds: 31536000 },
  { unit: "year", seconds: Infinity },
];

const DIVISORS: Record<Intl.RelativeTimeFormatUnit, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
  month: 2592000,
  year: 31536000,
  // aliases required by the type but unused
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 2592000,
  years: 31536000,
  quarter: 7776000,
  quarters: 7776000,
};

export async function POST(req: NextRequest) {
  let body: { timestamp?: unknown; now?: unknown; style?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { timestamp, now, style = "long", locale = "en-US" } = body ?? {};

  if (timestamp === undefined || timestamp === null) {
    return NextResponse.json({ error: "'timestamp' is required" }, { status: 400 });
  }

  const ts = new Date(timestamp as string | number);
  if (isNaN(ts.getTime())) {
    return NextResponse.json({ error: "'timestamp' is not a valid date" }, { status: 400 });
  }

  const nowDate = now !== undefined && now !== null ? new Date(now as string | number) : new Date();
  if (isNaN(nowDate.getTime())) {
    return NextResponse.json({ error: "'now' is not a valid date" }, { status: 400 });
  }

  const VALID_STYLES: Style[] = ["long", "short", "narrow"];
  if (!VALID_STYLES.includes(style as Style)) {
    return NextResponse.json(
      { error: "'style' must be one of: long, short, narrow" },
      { status: 400 },
    );
  }

  if (typeof locale !== "string") {
    return NextResponse.json({ error: "'locale' must be a string" }, { status: 400 });
  }

  const seconds_diff = (ts.getTime() - nowDate.getTime()) / 1000;
  const abs = Math.abs(seconds_diff);
  const is_future = seconds_diff > 0;

  const threshold = THRESHOLDS.find((t) => abs < t.seconds) ?? THRESHOLDS[THRESHOLDS.length - 1];
  const value = Math.round(seconds_diff / DIVISORS[threshold.unit]);

  let ago: string;
  try {
    const rtf = new Intl.RelativeTimeFormat(locale as string, { style: style as Style, numeric: "auto" });
    ago = rtf.format(value, threshold.unit);
  } catch {
    return NextResponse.json({ error: `Unsupported locale: ${locale}` }, { status: 400 });
  }

  return NextResponse.json({ ago, seconds_diff: Math.round(seconds_diff), is_future });
}
