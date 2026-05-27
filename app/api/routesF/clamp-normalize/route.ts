import { type NextRequest, NextResponse } from "next/server";

type ClampBody = {
  value?: unknown;
  min?: unknown;
  max?: unknown;
  normalize?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: ClampBody;

  try {
    body = (await req.json()) as ClampBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { value, min, max, normalize } = body;

  if (!isFiniteNumber(value) || !isFiniteNumber(min) || !isFiniteNumber(max)) {
    return badRequest("value, min, and max must be finite numbers.");
  }

  if (min > max) {
    return badRequest("min must be less than or equal to max.");
  }

  const clamped = Math.min(Math.max(value, min), max);

  if (normalize === true) {
    const normalized = min === max ? 0 : (clamped - min) / (max - min);
    return NextResponse.json({ clamped, normalized });
  }

  return NextResponse.json({ clamped });
}
