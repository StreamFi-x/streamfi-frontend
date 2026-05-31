import { type NextRequest, NextResponse } from "next/server";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function linearInterpolate(sorted: number[], p: number): number {
  if (p === 0) return sorted[0];
  if (p === 100) return sorted[sorted.length - 1];

  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const frac = rank - lower;
  return sorted[lower] + frac * (sorted[upper] - sorted[lower]);
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

  const { data, percentiles } = body as Record<string, unknown>;

  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: "data must be a non-empty array." }, { status: 400 });
  }
  if (!Array.isArray(percentiles) || percentiles.length === 0) {
    return NextResponse.json({ error: "percentiles must be a non-empty array." }, { status: 400 });
  }

  for (const val of data) {
    if (typeof val !== "number") {
      return NextResponse.json({ error: "All data values must be numbers." }, { status: 400 });
    }
  }

  for (const p of percentiles) {
    if (typeof p !== "number" || p < 0 || p > 100) {
      return NextResponse.json({ error: "All percentiles must be numbers between 0 and 100." }, { status: 400 });
    }
  }

  const sorted = [...(data as number[])].sort((a, b) => a - b);
  const results = (percentiles as number[]).map((p) => ({
    percentile: p,
    value: linearInterpolate(sorted, p),
  }));

  return NextResponse.json({ results });
}
