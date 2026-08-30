import { NextRequest, NextResponse } from "next/server";

function getBigrams(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.length < 2) {
    return [normalized];
  }
  const out: string[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    out.push(normalized.slice(i, i + 2));
  }
  return out;
}

function diceCoefficient(a: string, b: string) {
  if (a === b) {return 1;}
  const aBigrams = getBigrams(a);
  const bBigrams = getBigrams(b);

  const counts = new Map<string, number>();
  for (const gram of aBigrams) {
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }

  let intersection = 0;
  for (const gram of bBigrams) {
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      intersection += 1;
      counts.set(gram, count - 1);
    }
  }

  const denom = aBigrams.length + bBigrams.length;
  return denom === 0 ? 1 : (2 * intersection) / denom;
}

export async function POST(request: NextRequest) {
  let body: { a?: string; b?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.a !== "string" || typeof body.b !== "string") {
    return NextResponse.json(
      { error: "a and b must be strings" },
      { status: 400 }
    );
  }

  return NextResponse.json({ coefficient: diceCoefficient(body.a, body.b) });
}
