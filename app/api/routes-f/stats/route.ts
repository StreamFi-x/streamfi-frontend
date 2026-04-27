import { NextRequest, NextResponse } from "next/server";

const MAX_POINTS = 100_000;

function sorted(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

function median(s: number[]): number {
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function quantile(s: number[], q: number): number {
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (pos - lo) * (s[hi] - s[lo]);
}

function mode(arr: number[]): number[] {
  const freq = new Map<number, number>();
  for (const v of arr) freq.set(v, (freq.get(v) ?? 0) + 1);
  const max = Math.max(...freq.values());
  return [...freq.entries()].filter(([, c]) => c === max).map(([v]) => v).sort((a, b) => a - b);
}

export async function POST(req: NextRequest) {
  let body: { data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data } = body ?? {};

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
      { error: "All elements of 'data' must be finite numbers" },
      { status: 400 },
    );
  }

  const nums = data as number[];
  const s = sorted(nums);
  const n = nums.length;
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1 || 1);
  const stddev = Math.sqrt(variance);
  const q1 = quantile(s, 0.25);
  const q3 = quantile(s, 0.75);

  return NextResponse.json({
    count: n,
    sum,
    mean,
    median: median(s),
    mode: mode(nums),
    range: s[n - 1] - s[0],
    min: s[0],
    max: s[n - 1],
    variance,
    stddev,
    q1,
    q3,
    iqr: q3 - q1,
  });
}
