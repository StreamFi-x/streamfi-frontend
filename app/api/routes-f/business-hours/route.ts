import { NextRequest, NextResponse } from "next/server";

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h, m };
}

function toMinutes(h: number, m: number): number {
  return h * 60 + m;
}

export async function POST(req: NextRequest) {
  let body: {
    timestamp?: unknown;
    timezone?: unknown;
    open?: unknown;
    close?: unknown;
    days?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    timestamp,
    timezone = "UTC",
    open = "09:00",
    close = "17:00",
    days = [1, 2, 3, 4, 5],
  } = body;

  if (typeof timestamp !== "string") {
    return NextResponse.json({ error: "timestamp is required (ISO string)" }, { status: 400 });
  }

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
  }

  const tz = typeof timezone === "string" ? timezone : "UTC";
  const allowedDays = Array.isArray(days) ? (days as number[]) : [1, 2, 3, 4, 5];

  const localStr = date.toLocaleString("en-US", { timeZone: tz, hour12: false });
  const local = new Date(localStr);
  const dayOfWeek = local.getDay(); // 0=Sun
  const currentMins = toMinutes(local.getHours(), local.getMinutes());

  const { h: oh, m: om } = parseTime(typeof open === "string" ? open : "09:00");
  const { h: ch, m: cm } = parseTime(typeof close === "string" ? close : "17:00");
  const openMins = toMinutes(oh, om);
  const closeMins = toMinutes(ch, cm);

  const isOpen =
    allowedDays.includes(dayOfWeek) &&
    currentMins >= openMins &&
    currentMins < closeMins;

  if (isOpen) {
    return NextResponse.json({ is_open: true });
  }

  // Find next open time
  let next = new Date(date);
  for (let i = 1; i <= 7; i++) {
    next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
    const nextLocalStr = next.toLocaleString("en-US", { timeZone: tz, hour12: false });
    const nextLocal = new Date(nextLocalStr);
    if (allowedDays.includes(nextLocal.getDay())) {
      // set to open time
      nextLocal.setHours(oh, om, 0, 0);
      return NextResponse.json({ is_open: false, next_open: nextLocal.toISOString() });
    }
  }

  return NextResponse.json({ is_open: false });
}
