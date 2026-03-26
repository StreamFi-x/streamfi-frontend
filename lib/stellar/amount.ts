export function parseStellarAmountToInt(amount: string): bigint {
  // Stellar amounts are decimal strings with up to 7 fractional digits.
  // We convert to an integer scaled by 1e7 for safe comparisons.
  if (typeof amount !== "string" || amount.trim() === "") {
    throw new Error("Invalid amount");
  }
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid amount");
  }
  const [whole, fracRaw = ""] = normalized.split(".");
  const frac = (fracRaw + "0000000").slice(0, 7);
  return BigInt(whole) * BigInt(10_000_000) + BigInt(frac);
}

