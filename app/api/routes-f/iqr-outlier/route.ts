import { type NextRequest, NextResponse } from "next/server";

/**
 * Calculates the quartile value for a sorted dataset using linear interpolation.
 * Uses the inclusive method (same as Excel's QUARTILE.INC / NumPy default).
 */
function quartile(sorted: number[], q: 0.25 | 0.75): number {
  const pos = q * (sorted.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const frac = pos - lower;
  return sorted[lower] + frac * (sorted[upper] - sorted[lower]);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const { data, multiplier } = body as Record<string, unknown>;

  if (!Array.isArray(data) || data.length === 0 || data.some((v) => typeof v !== "number")) {
    return NextResponse.json(
      { error: "data must be a non-empty array of numbers." },
      { status: 400 }
    );
  }

  const m = multiplier !== undefined ? multiplier : 1.5;
  if (typeof m !== "number" || m < 0) {
    return NextResponse.json(
      { error: "multiplier must be a non-negative number." },
      { status: 400 }
    );
  }

  const sorted = [...(data as number[])].sort((a, b) => a - b);

  const q1 = quartile(sorted, 0.25);
  const q3 = quartile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower_bound = q1 - m * iqr;
  const upper_bound = q3 + m * iqr;
  const outliers = sorted.filter((v) => v < lower_bound || v > upper_bound);

  return NextResponse.json({ q1, q3, iqr, lower_bound, upper_bound, outliers });
}
