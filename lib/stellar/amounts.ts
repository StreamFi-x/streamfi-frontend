/**
 * Exact Stellar amount arithmetic. Horizon returns amounts as decimal strings
 * with up to 7 fractional digits (1 stroop = 0.0000001); tip_transactions
 * stores NUMERIC(20,7). Converting to integer stroops as BigInt keeps sums and
 * comparisons exact — never parseFloat a monetary amount.
 */
const SCALE = 7;
const ZERO = BigInt(0);
const UNIT = BigInt(10) ** BigInt(SCALE);
const AMOUNT_RE = /^(-)?(\d+)(?:\.(\d{1,7}))?$/;

export function toStroops(amount: string | number | bigint): bigint {
  if (typeof amount === "bigint") {
    return amount;
  }
  const text = typeof amount === "number" ? amount.toFixed(SCALE) : amount;
  const match = AMOUNT_RE.exec(text.trim());
  if (!match) {
    throw new Error(`Invalid Stellar amount: ${text}`);
  }
  const [, sign, whole, fraction = ""] = match;
  const stroops = BigInt(whole) * UNIT + BigInt(fraction.padEnd(SCALE, "0"));
  return sign ? -stroops : stroops;
}

export function fromStroops(stroops: bigint): string {
  const negative = stroops < ZERO;
  const abs = negative ? -stroops : stroops;
  const whole = abs / UNIT;
  const fraction = (abs % UNIT).toString().padStart(SCALE, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function absStroops(value: bigint): bigint {
  return value < ZERO ? -value : value;
}
