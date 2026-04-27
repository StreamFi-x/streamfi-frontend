import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_COST = 16384;

export function hashPassword(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(plaintext, salt, KEY_LENGTH, { N: SCRYPT_COST });
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(plaintext: string, hash: string): boolean {
  const [saltHex, keyHex] = hash.split(":");
  if (!saltHex || !keyHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const stored = Buffer.from(keyHex, "hex");
  const derived = scryptSync(plaintext, salt, KEY_LENGTH, { N: SCRYPT_COST });

  if (stored.length !== derived.length) {
    return false;
  }
  return timingSafeEqual(stored, derived);
}
