import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { activeKey, loadKeyring } from "@/lib/security/keyring";

function walletKeyring(purpose: "STELLAR" | "TOTP") {
  return loadKeyring(`${purpose}_ENCRYPTION_KEYRING_JSON`, purpose === "STELLAR" ? "STELLAR_ENCRYPTION_KEY" : "TOTP_ENCRYPTION_KEY", "hex");
}

export function encryptSecret(plaintext: string, purpose: "STELLAR" | "TOTP" = "STELLAR"): string {
  const { kid, key } = activeKey(walletKeyring(purpose));
  if (key.length !== 32) {throw new Error("Encryption keys must be 32 bytes");}
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${kid}:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(envelope: string, purpose: "STELLAR" | "TOTP" = "STELLAR"): string {
  const ring = walletKeyring(purpose);
  const parts = envelope.split(":");
  let ivHex: string;
  let tagHex: string;
  let ciphertextHex: string;
  let candidates: Buffer[];

  if (parts.length === 5 && parts[0] === "v1") {
    const key = ring.keys.get(parts[1]);
    if (!key) {throw new Error(`Unknown encryption key id: ${parts[1]}`);}
    [, , ivHex, tagHex, ciphertextHex] = parts;
    candidates = [key];
  } else if (parts.length === 3) {
    [ivHex, tagHex, ciphertextHex] = parts;
    candidates = [...ring.keys.values()];
  } else {
    throw new Error("Invalid encrypted secret format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) {
    throw new Error("Invalid encrypted secret components");
  }
  for (const key of candidates) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      continue;
    }
  }
  throw new Error("Unable to decrypt secret with configured keys");
}