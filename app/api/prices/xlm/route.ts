/**
 * Server-side proxy for XLM/USD spot price.
 * Fetches from Coinbase API server-side to avoid browser CORS restrictions.
 * Cached for 60s to reduce external requests.
 */
import { NextResponse } from "next/server";

let cached: { price: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET() {
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ price: cached.price }, { status: 200 });
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) {
      throw new Error(`CoinGecko responded with ${res.status}`);
    }

    const json = await res.json();
    const price = parseFloat(json?.stellar?.usd);

    if (isNaN(price)) {
      throw new Error("Invalid price data from Coinbase");
    }

    cached = { price, fetchedAt: now };
    return NextResponse.json({ price }, { status: 200 });
  } catch (err) {
    console.warn("[prices/xlm] Failed to fetch XLM price:", (err as Error).message);
    // Return last cached value if available, otherwise a safe fallback
    const fallback = cached?.price ?? 0.08;
    return NextResponse.json({ price: fallback, stale: true }, { status: 200 });
  }
}
