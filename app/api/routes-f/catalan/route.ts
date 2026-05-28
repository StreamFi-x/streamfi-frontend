import { NextRequest, NextResponse } from "next/server";

const MAX_N = 1000;

function parseN(req: NextRequest): number | null {
  const value = req.nextUrl.searchParams.get("n");
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }

  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= MAX_N ? n : null;
}

function catalanSequence(n: number): bigint[] {
  const sequence: bigint[] = [1n];

  for (let i = 0; i < n; i += 1) {
    const current = sequence[i];
    const next = (current * BigInt(2 * (2 * i + 1))) / BigInt(i + 2);
    sequence.push(next);
  }

  return sequence;
}

export async function GET(req: NextRequest) {
  const n = parseN(req);

  if (n === null) {
    return NextResponse.json(
      { error: `n must be an integer in [0, ${MAX_N}].` },
      { status: 400 }
    );
  }

  const sequence = catalanSequence(n).map(value => value.toString());

  return NextResponse.json({
    catalan: sequence[n],
    sequence,
  });
}
