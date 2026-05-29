import { NextRequest, NextResponse } from "next/server";

function mean(data: number[]): number {
  return data.reduce((s, v) => s + v, 0) / data.length;
}

function sampleStddev(data: number[], avg: number): number {
  const variance = data.reduce((s, v) => s + (v - avg) ** 2, 0) / (data.length - 1);
  return Math.sqrt(variance);
}

export async function POST(req: NextRequest) {
  let body: { data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body.data;
  if (!Array.isArray(data) || data.length < 2 || data.some((v) => typeof v !== "number")) {
    return NextResponse.json({ error: "data must be an array of at least 2 numbers" }, { status: 400 });
  }

  const avg = mean(data);
  const stddev = sampleStddev(data, avg);

  if (stddev === 0) {
    return NextResponse.json({ error: "Zero variance — z-scores are undefined" }, { status: 400 });
  }

  return NextResponse.json({
    mean: avg,
    stddev,
    z_scores: data.map((v) => (v - avg) / stddev),
  });
}
