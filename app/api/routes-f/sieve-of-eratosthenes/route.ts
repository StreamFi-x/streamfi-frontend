import { NextResponse } from 'next/server';

function sieveOfEratosthenes(limit: number): number[] {
  if (limit < 2) {return [];}

  const isPrime = Array(limit + 1).fill(true);
  isPrime[0] = isPrime[1] = false;

  for (let i = 2; i * i <= limit; i++) {
    if (isPrime[i]) {
      for (let j = i * i; j <= limit; j += i) {
        isPrime[j] = false;
      }
    }
  }

  const primes: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (isPrime[i]) {
      primes.push(i);
    }
  }

  return primes;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');

  if (!limitParam) {
    return NextResponse.json(
      { error: 'Missing limit parameter' },
      { status: 400 }
    );
  }

  const limit = parseInt(limitParam, 10);

  if (isNaN(limit) || limit < 2 || limit > 1000000) {
    return NextResponse.json(
      { error: 'Limit must be between 2 and 1000000' },
      { status: 400 }
    );
  }

  const primes = sieveOfEratosthenes(limit);

  return NextResponse.json({
    primes,
    count: primes.length,
  });
}
