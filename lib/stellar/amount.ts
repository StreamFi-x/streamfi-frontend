export function parseStellarAmountToInt(amount: string): bigint {
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
