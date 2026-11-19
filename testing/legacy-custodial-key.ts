import { createCipheriv, randomBytes } from "crypto";

/**
 * Produces a value in the pre-KMS custodial-key format exactly as the old
 * onboarding route did (`<iv_hex>:<authTag_hex>:<ciphertext_hex>`), for
 * migration and legacy-read tests.
 */
export function legacyEncrypt(plaintext: string, keyHex: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return [
    iv.toString("hex"),
    c.getAuthTag().toString("hex"),
    ct.toString("hex"),
  ].join(":");
}
