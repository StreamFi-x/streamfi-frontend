import { NextRequest, NextResponse } from "next/server";

type Unit = "km" | "mi";
type Mode = "pace" | "time" | "distance";

const RACE_DISTANCES: Record<string, { km: number; label: string }> = {
  "5K": { km: 5, label: "5K" },
  "10K": { km: 10, label: "10K" },
  "Half Marathon": { km: 21.0975, label: "Half Marathon" },
  "Marathon": { km: 42.195, label: "Marathon" },
};

const KM_PER_MI = 1.60934;

function parseTime(s: string): number | null {
  const parts = s.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function parsePace(s: string): number | null {
  // mm:ss per unit → seconds
  const parts = s.split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return parts[0] * 60 + parts[1];
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatPace(secondsPerUnit: number): string {
  const m = Math.floor(secondsPerUnit / 60);
  const s = Math.round(secondsPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function splits(paceSecPerKm: number, unit: Unit): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, { km }] of Object.entries(RACE_DISTANCES)) {
    const distanceInUnit = unit === "km" ? km : km / KM_PER_MI;
    const totalSec = paceSecPerKm * km;
    result[name] = formatTime(Math.round(totalSec));
    void distanceInUnit; // used for pace display only
  }
  return result;
}

export async function POST(req: NextRequest) {
  let body: {
    mode?: unknown;
    distance?: unknown;
    time?: unknown;
    pace?: unknown;
    unit?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mode, distance, time, pace, unit = "km" } = body ?? {};

  if (mode !== "pace" && mode !== "time" && mode !== "distance") {
    return NextResponse.json(
      { error: "'mode' must be one of: pace, time, distance" },
      { status: 400 },
    );
  }
  if (unit !== "km" && unit !== "mi") {
    return NextResponse.json({ error: "'unit' must be 'km' or 'mi'" }, { status: 400 });
  }

  const u = unit as Unit;
  const m = mode as Mode;

  if (m === "pace") {
    // Given distance + time → compute pace
    if (typeof distance !== "number" || distance <= 0) {
      return NextResponse.json({ error: "'distance' must be a positive number" }, { status: 400 });
    }
    if (typeof time !== "string") {
      return NextResponse.json({ error: "'time' must be a hh:mm:ss string" }, { status: 400 });
    }
    const totalSec = parseTime(time);
    if (totalSec === null || totalSec <= 0) {
      return NextResponse.json({ error: "'time' is not a valid hh:mm:ss value" }, { status: 400 });
    }
    const secPerUnit = totalSec / (distance as number);
    const paceSecPerKm = u === "km" ? secPerUnit : secPerUnit / KM_PER_MI;
    return NextResponse.json({
      pace: `${formatPace(secPerUnit)} per ${u}`,
      distance,
      time,
      unit: u,
      race_splits: splits(paceSecPerKm, u),
    });
  }

  if (m === "time") {
    // Given distance + pace → compute time
    if (typeof distance !== "number" || distance <= 0) {
      return NextResponse.json({ error: "'distance' must be a positive number" }, { status: 400 });
    }
    if (typeof pace !== "string") {
      return NextResponse.json({ error: "'pace' must be a mm:ss string" }, { status: 400 });
    }
    const secPerUnit = parsePace(pace);
    if (secPerUnit === null || secPerUnit <= 0) {
      return NextResponse.json({ error: "'pace' is not a valid mm:ss value" }, { status: 400 });
    }
    const totalSec = secPerUnit * (distance as number);
    const paceSecPerKm = u === "km" ? secPerUnit : secPerUnit / KM_PER_MI;
    return NextResponse.json({
      time: formatTime(Math.round(totalSec)),
      distance,
      pace: `${pace} per ${u}`,
      unit: u,
      race_splits: splits(paceSecPerKm, u),
    });
  }

  // mode === "distance": given time + pace → compute distance
  if (typeof time !== "string") {
    return NextResponse.json({ error: "'time' must be a hh:mm:ss string" }, { status: 400 });
  }
  if (typeof pace !== "string") {
    return NextResponse.json({ error: "'pace' must be a mm:ss string" }, { status: 400 });
  }
  const totalSec = parseTime(time);
  const secPerUnit = parsePace(pace);
  if (totalSec === null || totalSec <= 0) {
    return NextResponse.json({ error: "'time' is not a valid hh:mm:ss value" }, { status: 400 });
  }
  if (secPerUnit === null || secPerUnit <= 0) {
    return NextResponse.json({ error: "'pace' is not a valid mm:ss value" }, { status: 400 });
  }
  const dist = Math.round((totalSec / secPerUnit) * 100) / 100;
  const paceSecPerKm = u === "km" ? secPerUnit : secPerUnit / KM_PER_MI;
  return NextResponse.json({
    distance: dist,
    time,
    pace: `${pace} per ${u}`,
    unit: u,
    race_splits: splits(paceSecPerKm, u),
  });
}
