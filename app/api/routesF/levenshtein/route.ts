import { NextRequest, NextResponse } from "next/server";

type LevenshteinBody = {
  a?: unknown;
  b?: unknown;
};

const MAX_INPUT_BYTES = 10 * 1024;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function getByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function computeLevenshteinDistance(a: string, b: string) {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) {
    previous[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

export async function POST(req: NextRequest) {
  let body: LevenshteinBody;

  try {
    body = (await req.json()) as LevenshteinBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { a, b } = body;

  if (typeof a !== "string" || typeof b !== "string") {
    return badRequest("a and b must be strings.");
  }

  if (
    getByteLength(a) > MAX_INPUT_BYTES ||
    getByteLength(b) > MAX_INPUT_BYTES
  ) {
    return badRequest("Inputs must not exceed 10KB each.");
  }

  const distance = computeLevenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  const ratio = maxLength === 0 ? 1 : 1 - distance / maxLength;

  return NextResponse.json({
    distance,
    ratio,
  });
}
