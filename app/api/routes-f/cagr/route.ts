import { NextRequest, NextResponse } from "next/server";

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export async function POST(req: NextRequest) {
  let body: { begin_value?: unknown; end_value?: unknown; years?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const beginValue = finitePositive(body.begin_value);
  const endValue = finitePositive(body.end_value);
  const years = finitePositive(body.years);

  if (beginValue === null || endValue === null || years === null) {
    return NextResponse.json(
      { error: "begin_value, end_value, and years must be positive numbers." },
      { status: 400 }
    );
  }

  const cagrPercent = (Math.pow(endValue / beginValue, 1 / years) - 1) * 100;

  return NextResponse.json({
    cagr_percent: cagrPercent,
  });
}
