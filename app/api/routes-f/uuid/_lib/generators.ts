/**
 * UUID generation — inline, no external libraries (#562).
 */

const HEX = "0123456789abcdef";

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => HEX[b >> 4] + HEX[b & 0xf]).join("");
}

/**
 * UUID v4 — 128 random bits with version and variant fields set.
 */
export function uuidV4(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = bytesToHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * UUID v7 — Unix timestamp (ms) in the high 48 bits, random bits for the rest.
 * Produces monotonically increasing UUIDs within the same millisecond.
 */
export function uuidV7(): string {
  const ms = BigInt(Date.now());
  const rand = randomBytes(10);

  // 48-bit ms timestamp in big-endian
  const msHex = ms.toString(16).padStart(12, "0");

  // 4-bit version (7), 12 random bits
  const ver = 0x7000 | ((rand[0] << 4) | (rand[1] >> 4));
  const verHex = ver.toString(16).padStart(4, "0");

  // 2-bit variant (10xx), 62 random bits across 2 groups
  const varByte = ((rand[2] & 0x3f) | 0x80).toString(16).padStart(2, "0");
  const tailHex = bytesToHex(rand.slice(3));

  return `${msHex.slice(0, 8)}-${msHex.slice(8)}-${verHex}-${varByte}${tailHex.slice(0, 2)}-${tailHex.slice(2, 14)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}
