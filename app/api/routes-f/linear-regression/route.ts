import { NextRequest, NextResponse } from "next/server";

const MAX_POINTS = 100_000;

type RegressionBody = {
  x?: unknown;
  y?: unknown;
  predict_x?: unknown;
};

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export async function POST(req: NextRequest) {
  let body: RegressionBody;
  try {
    body = (await req.json()) as RegressionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isNumberArray(body?.x) || !isNumberArray(body?.y)) {
    return NextResponse.json(
      { error: "'x' and 'y' must be arrays of finite numbers" },
      { status: 400 },
    );
  }

  const x = body.x;
  const y = body.y;

  if (x.length !== y.length) {
    return NextResponse.json(
      { error: "'x' and 'y' must have equal lengths" },
      { status: 400 },
    );
  }
  if (x.length < 2) {
    return NextResponse.json(
      { error: "At least 2 points are required" },
      { status: 400 },
    );
  }
  if (x.length > MAX_POINTS) {
    return NextResponse.json(
      { error: `Input is capped at ${MAX_POINTS} points` },
      { status: 400 },
    );
  }

  if (body.predict_x !== undefined && !isNumberArray(body.predict_x)) {
    return NextResponse.json(
      { error: "'predict_x' must be an array of finite numbers when provided" },
      { status: 400 },
    );
  }

  const n = x.length;
  const sumX = x.reduce((acc, v) => acc + v, 0);
  const sumY = y.reduce((acc, v) => acc + v, 0);
  const sumXY = x.reduce((acc, v, i) => acc + v * y[i], 0);
  const sumXX = x.reduce((acc, v) => acc + v * v, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return NextResponse.json(
      { error: "Cannot fit a line when all x values are identical" },
      { status: 400 },
    );
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTot = y.reduce((acc, yi) => acc + (yi - meanY) ** 2, 0);
  const ssRes = y.reduce((acc, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return acc + (yi - predicted) ** 2;
  }, 0);
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  const slopeRounded = round(slope);
  const interceptRounded = round(intercept);
  const sign = interceptRounded >= 0 ? "+" : "-";
  const equation = `y = ${slopeRounded}x ${sign} ${Math.abs(interceptRounded)}`;

  const response: {
    slope: number;
    intercept: number;
    r_squared: number;
    equation: string;
    predictions?: number[];
  } = {
    slope: slopeRounded,
    intercept: interceptRounded,
    r_squared: round(rSquared),
    equation,
  };

  if (body.predict_x) {
    response.predictions = body.predict_x.map((px) =>
      round(slope * px + intercept),
    );
  }

  return NextResponse.json(response);
}
