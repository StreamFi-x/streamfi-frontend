import { type NextRequest, NextResponse } from "next/server";

type InterpolationBody = {
  mode?: unknown;
  a?: unknown;
  b?: unknown;
  t?: unknown;
  value?: unknown;
  in_min?: unknown;
  in_max?: unknown;
  out_min?: unknown;
  out_max?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: InterpolationBody;

  try {
    body = (await req.json()) as InterpolationBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  if (body.mode === "lerp") {
    const { a, b, t } = body;

    if (!isFiniteNumber(a) || !isFiniteNumber(b) || !isFiniteNumber(t)) {
      return badRequest("a, b, and t must be finite numbers.");
    }

    return NextResponse.json({ result: a + (b - a) * t });
  }

  if (body.mode === "map") {
    const { value, in_min, in_max, out_min, out_max } = body;

    if (
      !isFiniteNumber(value) ||
      !isFiniteNumber(in_min) ||
      !isFiniteNumber(in_max) ||
      !isFiniteNumber(out_min) ||
      !isFiniteNumber(out_max)
    ) {
      return badRequest("value, in_min, in_max, out_min, and out_max must be finite numbers.");
    }

    if (in_min === in_max) {
      return badRequest("in_min and in_max must be different values.");
    }

    const ratio = (value - in_min) / (in_max - in_min);
    return NextResponse.json({ result: out_min + ratio * (out_max - out_min) });
  }

  return badRequest("mode must be either lerp or map.");
}
