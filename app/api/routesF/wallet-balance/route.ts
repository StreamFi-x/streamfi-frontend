import { NextRequest, NextResponse } from 'next/server';
import { cacheBalance, getCached, remainingTtl } from './store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'wallet is required' }, { status: 400 });
  }

  let entry = getCached(wallet);
  if (!entry) {
    entry = cacheBalance(wallet);
    if (!entry) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }
  }

  return NextResponse.json({
    balance_xlm: entry.balance_xlm,
    balance_usdc: entry.balance_usdc,
    cached_at: entry.cached_at,
    ttl_seconds: remainingTtl(entry),
  });
}
