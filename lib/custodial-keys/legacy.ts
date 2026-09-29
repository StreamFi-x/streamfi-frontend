import { createDecipheriv } from "crypto";
import { CustodialKeyError } from "./errors";

/**
 * Legacy (v1) custodial-key format: AES-256-GCM under the single static
 * STELLAR_ENCRYPTION_KEY, stored as `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 *
 * Decrypt-only. Nothing writes this format any more; it exists so the
 * migration can read old rows and so unmigrated rows stay readable during the
 * rollout window. Once STELLAR_ENCRYPTION_KEY is removed from the
 * environment this path fails closed with LEGACY_KEY_UNAVAILABLE.
 */

const LEGACY_FORMAT = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

export function isLegacyFormat(stored: string): boolean {
  return LEGACY_FORMAT.test(stored);
}

function legacyKey(): Buffer {
  const hex = process.env.STELLAR_ENCRYPTION_KEY;
  if (!hex) {
    throw new CustodialKeyError(
      "LEGACY_KEY_UNAVAILABLE",
      "Legacy custodial key found but STELLAR_ENCRYPTION_KEY is not configured"
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new CustodialKeyError(
      "LEGACY_KEY_UNAVAILABLE",
      "STELLAR_ENCRYPTION_KEY misconfigured"
    );
  }
  return Buffer.from(hex, "hex");
}

export function decryptLegacyCustodialSecret(stored: string): string {
  if (!isLegacyFormat(stored)) {
    throw new CustodialKeyError(
      "LEGACY_FORMAT_INVALID",
      "Stored value is not in the legacy custodial-key format"
    );
  }
  const [ivHex, tagHex, ctHex] = stored.split(":");
  const key = legacyKey();
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex"),
      { authTagLength: 16 }
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new CustodialKeyError(
      "LEGACY_AUTH_FAILED",
      "Legacy custodial key failed authentication"
    );
  } finally {
    key.fill(0);
  }
}
