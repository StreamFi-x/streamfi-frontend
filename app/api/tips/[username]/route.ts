import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { fetchPaymentsReceived } from '@/lib/stellar/horizon';
import { getStellarNetwork } from '@/lib/stellar/config';

type TipRecord = {
  id: string;
  sender: string;
  senderUsername?: string | null;
  amount: string;
  asset: string;
  txHash: string;
  timestamp: string;
};

interface TipHistoryResponse {
  tips: TipRecord[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
  total: {
    received: string;
    count: number;
  };
}

// Simple in-memory cache: key -> { ts, data }
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const cache = new Map<string, { ts: number; data: TipHistoryResponse }>();

function buildCacheKey(username: string, limit: number, cursor?: string) {
  return `${username}|${limit}|${cursor || ''}`;
}

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Number.isNaN(rawLimit) ? 20 : Math.min(rawLimit, 100);
    const cursor = searchParams.get('cursor') || undefined;

    const username = params.username;
    if (!username || typeof username !== 'string' || username.length > 64) {
      return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
    }

    const cacheKey = buildCacheKey(username, limit, cursor);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // 1. Fetch user from database
    const userResult = await sql`
      SELECT stellar_public_key, total_tips_received, total_tips_count
      FROM users
      WHERE username = ${username}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0] as {
      stellar_public_key?: string | null;
      total_tips_received?: string | null;
      total_tips_count?: number | null;
    };

    if (!user.stellar_public_key) {
      return NextResponse.json({ error: 'User has not configured Stellar wallet' }, { status: 404 });
    }

    // 2. Fetch payments from Horizon API
    const network = getStellarNetwork();
    const { tips, nextCursor } = await fetchPaymentsReceived({
      publicKey: user.stellar_public_key,
      limit,
      cursor,
      network,
    });

    // 3. Map sender public keys to usernames (if they exist in our DB)
    const senderKeys = Array.from(new Set(tips.map((t: any) => String(t.sender)))) as string[];

    let senderMap = new Map<string, string>();
    if (senderKeys.length > 0) {
      // Build IN clause with proper escaping using sql.raw()
      const escapedKeys = senderKeys
        .map(key => `'${key.replace(/'/g, "''")}'`)
        .join(',');
      const senderUsers = await sql`
        SELECT username, stellar_public_key
        FROM users
        WHERE stellar_public_key IN (${sql.raw(escapedKeys)})
      `;

      senderMap = new Map(senderUsers.rows.map((u: any) => [u.stellar_public_key, u.username]));
    }

    const tipsWithUsernames: TipRecord[] = tips.map((tip: any) => ({
      id: tip.id,
      sender: tip.sender,
      senderUsername: senderMap.get(tip.sender) || null,
      amount: tip.amount,
      asset: tip.asset,
      txHash: tip.txHash,
      timestamp: new Date(tip.timestamp).toISOString(),
    }));

    const response: TipHistoryResponse = {
      tips: tipsWithUsernames,
      pagination: {
        nextCursor: nextCursor || null,
        hasMore: !!nextCursor,
      },
      total: {
        received: user.total_tips_received || '0',
        count: user.total_tips_count || 0,
      },
    };

    // Cache response
    cache.set(cacheKey, { ts: Date.now(), data: response });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Tip history fetch error:', error);
    if (error?.message && error.message.includes('timeout')) {
      return NextResponse.json({ error: 'Horizon API timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to fetch tip history' }, { status: 500 });
  }
}
