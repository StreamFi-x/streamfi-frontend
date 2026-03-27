let cachedPrice: { price: number; fetchedAt: number } | null = null;
const PRICE_TTL_MS = 60_000;

export async function getXlmUsdPrice(): Promise<number> {
  const now = Date.now();
  if (cachedPrice && now - cachedPrice.fetchedAt < PRICE_TTL_MS) {
    return cachedPrice.price;
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
      throw new Error(`Price provider returned ${response.status}`);
    }

    const payload = await response.json();
    const price = Number.parseFloat(payload?.price);

    if (!Number.isFinite(price)) {
      throw new Error("Price payload was invalid");
    }

    cachedPrice = { price, fetchedAt: now };
    return price;
  } catch (error) {
    console.warn("[routes-f price] Falling back to cached XLM price:", error);
    return cachedPrice?.price ?? 0.08;
  }
}
