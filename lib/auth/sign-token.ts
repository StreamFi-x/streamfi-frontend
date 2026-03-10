import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signs a JSON payload with HMAC-SHA256.
 * Returns "<base64url_payload>.<base64url_signature>".
 *
 * The payload is not encrypted — only authenticated.
 * Do not put secrets in the payload.
 */
export function signToken(payload: object, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
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
  secret: string
): T | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) {return null;}

  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = createHmac("sha256", secret).update(data).digest("base64url");

  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    // Lengths must match for timingSafeEqual; mismatched length = invalid sig
    if (a.length !== b.length || !timingSafeEqual(a, b)) {return null;}
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as T & { exp?: number };

    // Reject expired tokens
    if (typeof parsed.exp === "number" && Math.floor(Date.now() / 1000) > parsed.exp) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
