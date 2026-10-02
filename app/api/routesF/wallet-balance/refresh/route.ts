/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { cacheBalance, TTL_SECONDS } from '../store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet } = body;

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ error: 'wallet is required' }, { status: 400 });
    }

    const entry = cacheBalance(wallet);
    if (!entry) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    return NextResponse.json({
      balance_xlm: entry.balance_xlm,
      balance_usdc: entry.balance_usdc,
      cached_at: entry.cached_at,
      ttl_seconds: TTL_SECONDS,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
