import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "crypto";

// ── Base32 (RFC 4648, no padding needed for otpauth) ──────────────────────────

const B32_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHA[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32_ALPHA[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHA.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character: " + ch);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

// ── TOTP (RFC 6238 / RFC 4226) ────────────────────────────────────────────────

function hotpCode(keyBuf: Buffer, counter: bigint): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const hmac = createHmac("sha1", keyBuf).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export function generateTotpCode(secret: string, windowOffset = 0): string {
  const counter = BigInt(Math.floor(Date.now() / 1000 / 30)) + BigInt(windowOffset);
  return hotpCode(base32Decode(secret), counter);
}

export function verifyTotpToken(secret: string, token: string): boolean {
  for (const w of [-1, 0, 1]) {
    if (generateTotpCode(secret, w) === token) return true;
  }
  return false;
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildOtpauthUri(secret: string, account: string, issuer = "StreamFi"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ── AES-256-GCM secret encryption ────────────────────────────────────────────

function resolveKey(): Buffer {
  const raw =
    process.env.TWO_FA_ENCRYPTION_KEY ??
    process.env.STELLAR_ENCRYPTION_KEY ??
    process.env.SESSION_SECRET;
  if (!raw) throw new Error("Missing encryption key env var");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  // SHA-256 of passphrase → 32-byte key
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(raw).digest();
}

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: (cipher as ReturnType<typeof createCipheriv> & { getAuthTag(): Buffer }).getAuthTag().toString("base64"),
  };
}

export function decryptSecret(enc: EncryptedSecret): string {
  const key = resolveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(enc.iv, "base64"));
  (decipher as ReturnType<typeof createDecipheriv> & { setAuthTag(t: Buffer): void }).setAuthTag(Buffer.from(enc.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ── Backup codes ──────────────────────────────────────────────────────────────

export function generateBackupCodes(count = 5): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
  );
}
