import { type NextRequest, NextResponse } from "next/server";

type ROIBody = {
  initial?: unknown;
  final?: unknown;
  years?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: ROIBody;

  try {
    body = (await req.json()) as ROIBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { initial, final, years } = body;

  if (!isFiniteNumber(initial) || !isFiniteNumber(final)) {
    return badRequest("initial and final must be finite numbers.");
  }

  if (initial === 0) {
    return badRequest("initial must not be zero.");
  }

  const gain = final - initial;
  const roi_percent = (gain / Math.abs(initial)) * 100;

  const result: Record<string, number> = { roi_percent, gain };

  if (years !== undefined) {
    if (!isFiniteNumber(years) || years <= 0) {
      return badRequest("years must be a positive number.");
    }
    result.annualized_percent =
      (Math.pow(final / initial, 1 / years) - 1) * 100;
  }

  return NextResponse.json(result);
}
