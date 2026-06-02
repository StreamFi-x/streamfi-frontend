import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitStr = searchParams.get('limit');

  if (!limitStr) {
    return NextResponse.json({ error: 'Missing limit parameter' }, { status: 400 });
  }

  const limit = parseInt(limitStr, 10);

  if (isNaN(limit) || limit < 3 || limit > 1000000) {
    return NextResponse.json({ error: 'limit must be an integer between 3 and 1000000' }, { status: 400 });
  }

  const isPrime = new Uint8Array(limit + 1);
  isPrime.fill(1);
  isPrime[0] = 0;
  isPrime[1] = 0;

  for (let p = 2; p * p <= limit; p++) {
    if (isPrime[p] === 1) {
      for (let i = p * p; i <= limit; i += p) {
        isPrime[i] = 0;
      }
    }
  }

  const pairs: [number, number][] = [];
  
  for (let i = 3; i <= limit - 2; i += 2) {
    if (isPrime[i] === 1 && isPrime[i + 2] === 1) {
      pairs.push([i, i + 2]);
    }
  }

  return NextResponse.json({
    pairs,
    count: pairs.length
  });
}
