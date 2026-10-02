import { createHmac, timingSafeEqual } from "crypto";
import { activeKey, type Keyring } from "@/lib/security/keyring";

/**
 * Signs a JSON payload with HMAC-SHA256.
 * Returns "<base64url_payload>.<base64url_signature>".
 *
 * The payload is not encrypted — only authenticated.
 * Do not put secrets in the payload.
 */
export function signToken(payload: object, secret: string | Keyring): string {
  const signingKey = typeof secret === "string"
    ? { key: Buffer.from(secret), kid: null }
    : { ...activeKey(secret), kid: secret.activeKid };
  const signedPayload = signingKey.kid ? { ...payload, __kid: signingKey.kid } : payload;
  const data = Buffer.from(JSON.stringify(signedPayload)).toString("base64url");
  const sig = createHmac("sha256", signingKey.key).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Verifies a signed token and returns the decoded payload.
 * Returns null on any failure: wrong signature, malformed, or expired.
 *
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyToken<T extends object>(
  token: string,
  secret: string | Keyring
): T | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) {
    return null;
  }

  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  try {
    const a = Buffer.from(sig, "base64url");
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as T & { exp?: number; __kid?: string };

    const keys = typeof secret === "string"
      ? [Buffer.from(secret)]
      : typeof parsed.__kid === "string"
        ? [secret.keys.get(parsed.__kid)].filter((key): key is Buffer => !!key)
        : [...secret.keys.values()];
    let valid = false;
    for (const key of keys) {
      const expected = createHmac("sha256", key).update(data).digest();
      if (a.length === expected.length && timingSafeEqual(a, expected)) {valid = true;}
    }
    if (!valid) {return null;}

    // Reject expired tokens
    if (
      typeof parsed.exp === "number" &&
      Math.floor(Date.now() / 1000) > parsed.exp
    ) {
      return null;
    }

    delete parsed.__kid;
    return parsed;
  } catch {
    return null;
  }
}
