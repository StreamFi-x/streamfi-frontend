import { type NextRequest, NextResponse } from "next/server";

const RACE_DISTANCES_KM: Record<string, number> = {
  "1K": 1,
  "5K": 5,
  "10K": 10,
  "Half Marathon": 21.0975,
  Marathon: 42.195,
};

const RACE_DISTANCES_MI: Record<string, number> = {
  "1 mile": 1,
  "5K": 3.10686,
  "10K": 6.21371,
  "Half Marathon": 13.1094,
  Marathon: 26.2188,
};

function parseTime(t: string): number | null {
  const parts = t.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function parsePace(p: string): number | null {
  const parts = p.split(":").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return parts[0] * 60 + parts[1];
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatPace(secsPerUnit: number, unit: string): string {
  const m = Math.floor(secsPerUnit / 60);
  const s = Math.round(secsPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")} per ${unit}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const { mode, distance, time, pace, unit = "km" } = body as Record<string, unknown>;

  if (unit !== "km" && unit !== "mi") {
    return NextResponse.json({ error: "unit must be 'km' or 'mi'." }, { status: 400 });
  }
  if (mode !== "pace" && mode !== "time" && mode !== "distance") {
    return NextResponse.json({ error: "mode must be 'pace', 'time', or 'distance'." }, { status: 400 });
  }

  const unitLabel = unit as string;

  if (mode === "pace") {
    if (typeof distance !== "number" || distance <= 0) {
      return NextResponse.json({ error: "distance must be a positive number for mode 'pace'." }, { status: 400 });
    }
    if (typeof time !== "string") {
      return NextResponse.json({ error: "time must be a string in HH:MM:SS format." }, { status: 400 });
    }
    const totalSecs = parseTime(time as string);
    if (totalSecs === null) {
      return NextResponse.json({ error: "Invalid time format. Use HH:MM:SS." }, { status: 400 });
    }
    const secsPerUnit = totalSecs / (distance as number);
    const paceStr = formatPace(secsPerUnit, unitLabel);

    const raceDists = unitLabel === "mi" ? RACE_DISTANCES_MI : RACE_DISTANCES_KM;
    const race_splits: Record<string, string> = {};
    for (const [name, d] of Object.entries(raceDists)) {
      race_splits[name] = formatTime(secsPerUnit * d);
    }

    return NextResponse.json({ pace: paceStr, race_splits });
  }

  if (mode === "time") {
    if (typeof distance !== "number" || distance <= 0) {
      return NextResponse.json({ error: "distance must be a positive number for mode 'time'." }, { status: 400 });
    }
    if (typeof pace !== "string") {
      return NextResponse.json({ error: "pace must be a string in M:SS format." }, { status: 400 });
    }
    const paceSecs = parsePace(pace as string);
    if (paceSecs === null) {
      return NextResponse.json({ error: "Invalid pace format. Use M:SS." }, { status: 400 });
    }
    const totalSecs = paceSecs * (distance as number);
    return NextResponse.json({ time: formatTime(totalSecs) });
  }

  // mode === "distance"
  if (typeof time !== "string") {
    return NextResponse.json({ error: "time must be a string in HH:MM:SS format." }, { status: 400 });
  }
  if (typeof pace !== "string") {
    return NextResponse.json({ error: "pace must be a string in M:SS format." }, { status: 400 });
  }
  const totalSecs = parseTime(time as string);
  if (totalSecs === null) {
    return NextResponse.json({ error: "Invalid time format. Use HH:MM:SS." }, { status: 400 });
  }
  const paceSecs = parsePace(pace as string);
  if (paceSecs === null) {
    return NextResponse.json({ error: "Invalid pace format. Use M:SS." }, { status: 400 });
  }
  const dist = Math.round((totalSecs / paceSecs) * 100) / 100;
  return NextResponse.json({ distance: dist });
}
