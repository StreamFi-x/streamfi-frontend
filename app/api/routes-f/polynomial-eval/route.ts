import { type NextRequest, NextResponse } from "next/server";

/**
 * Evaluates a polynomial at a given x value using Horner's method.
 * Coefficients are ordered highest-degree first.
 * e.g. [3, 2, 1] represents 3x² + 2x + 1
 */
function horner(coefficients: number[], x: number): number {
  return coefficients.reduce((acc, coef) => acc * x + coef, 0);
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

  const { coefficients, x } = body as Record<string, unknown>;

  if (
    !Array.isArray(coefficients) ||
    coefficients.length === 0 ||
    coefficients.some((c) => typeof c !== "number")
  ) {
    return NextResponse.json(
      { error: "coefficients must be a non-empty array of numbers." },
      { status: 400 }
    );
  }

  const isArrayOfX = Array.isArray(x);
  const xValues: unknown[] = isArrayOfX ? x : [x];

  if (xValues.some((v) => typeof v !== "number")) {
    return NextResponse.json(
      { error: "x must be a number or an array of numbers." },
      { status: 400 }
    );
  }

  const results = (xValues as number[]).map((xVal) => horner(coefficients as number[], xVal));

  return NextResponse.json({ results });
}
