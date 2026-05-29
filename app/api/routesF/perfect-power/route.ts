import { NextResponse } from 'next/server';
import { analyzePerfectPower, parsePositiveInteger } from './analyze';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nParam = searchParams.get('n');

  if (nParam === null) {
    return NextResponse.json({ error: 'Missing required query parameter n' }, { status: 400 });
  }

  const n = parsePositiveInteger(nParam);
  if (n === null) {
    return NextResponse.json(
      { error: 'Invalid n value. Must be a non-negative integer.' },
      { status: 400 }
    );
  }

  return NextResponse.json(analyzePerfectPower(n));
}
