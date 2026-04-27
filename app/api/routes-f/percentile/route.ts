import { NextRequest, NextResponse } from "next/server";

const MAX_POINTS = 100_000;
const MAX_PERCENTILES = 100;

function quantile(sorted: number[], p: number): number {
  if (p === 0) return sorted[0];
  if (p === 100) return sorted[sorted.length - 1];
  const pos = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

export async function POST(req: NextRequest) {
  let body: { data?: unknown; percentiles?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data, percentiles } = body ?? {};

  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json(
      { error: "'data' must be a non-empty array of numbers" },
      { status: 400 },
    );
  }
  if (data.length > MAX_POINTS) {
    return NextResponse.json(
      { error: `Dataset must not exceed ${MAX_POINTS} points` },
      { status: 400 },
    );
  }
  if (!data.every((v) => typeof v === "number" && isFinite(v))) {
    return NextResponse.json(
      { error: "All data values must be finite numbers" },
      { status: 400 },
    );
  }

  if (!Array.isArray(percentiles) || percentiles.length === 0) {
    return NextResponse.json(
      { error: "'percentiles' must be a non-empty array of numbers in [0,100]" },
      { status: 400 },
    );
  }
  if (percentiles.length > MAX_PERCENTILES) {
    return NextResponse.json(
      { error: `Percentile list must not exceed ${MAX_PERCENTILES} entries` },
      { status: 400 },
    );
  }
  if (!percentiles.every((p) => typeof p === "number" && p >= 0 && p <= 100)) {
    return NextResponse.json(
      { error: "Each percentile must be a number in [0, 100]" },
      { status: 400 },
    );
  }

  const sorted = [...(data as number[])].sort((a, b) => a - b);

  const results = (percentiles as number[]).map((p) => ({
    percentile: p,
    value: quantile(sorted, p),
  }));

  return NextResponse.json({ results });
}
