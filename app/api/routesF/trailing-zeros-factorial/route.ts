import { type NextRequest, NextResponse } from "next/server";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseN(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function countTrailingZeros(n: number): number {
  let count = 0;
  let divisor = 5;

  while (divisor <= n) {
    count += Math.floor(n / divisor);
    divisor *= 5;
  }

  return count;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const n = parseN(url.searchParams.get("n"));

  if (n === null || n < 0 || n > 1000000) {
    return badRequest("n must be an integer between 0 and 1000000.");
  }

  return NextResponse.json({ n, trailing_zeros: countTrailingZeros(n) });
}
