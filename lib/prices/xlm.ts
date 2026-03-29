let cachedPrice: { price: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getCachedXlmUsdPrice(): Promise<{
  price: number;
  stale: boolean;
}> {
  const now = Date.now();

  if (cachedPrice && now - cachedPrice.fetchedAt < CACHE_TTL_MS) {
    return { price: cachedPrice.price, stale: false };
  }

  try {
    const response = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT",
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      throw new Error(`Binance responded with ${response.status}`);
    }

    const payload = await response.json();
    const price = Number.parseFloat(payload?.price);

    if (!Number.isFinite(price)) {
      throw new Error("Invalid price data from Binance");
    }

    cachedPrice = { price, fetchedAt: now };
    return { price, stale: false };
  } catch (error) {
    console.warn(
      "[prices/xlm] Failed to refresh XLM price:",
      error instanceof Error ? error.message : error
    );

    return {
      price: cachedPrice?.price ?? 0.08,
      stale: true,
    };
  }
}
