import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies a Privy webhook request using Privy's svix-based signing scheme.
 *
 * Privy signs webhook payloads the way svix does:
 * - Headers: `svix-id`, `svix-timestamp`, `svix-signature`
 * - Signed content: `${svix-id}.${svix-timestamp}.${rawBody}`
 * - Secret: the webhook signing secret, provided as `whsec_<base64>` —
 *   we strip the `whsec_` prefix and base64-decode the remainder before
 *   using it as the HMAC-SHA256 key.
 * - `svix-signature` header value: one or more space-separated
 *   `v1,<base64 signature>` entries. We accept the request if ANY of the
 *   listed signatures matches (mirrors svix's own verification behavior,
 *   which supports secret rotation via multiple valid signatures).
 *
 * Also rejects requests whose `svix-timestamp` is more than 5 minutes from
 * the current time, to mitigate replay attacks.
 */

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

export interface PrivySignatureHeaders {
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
}

export function getPrivySignatureHeaders(req: {
  headers: { get(name: string): string | null };
}): PrivySignatureHeaders {
  return {
    svixId: req.headers.get("svix-id"),
    svixTimestamp: req.headers.get("svix-timestamp"),
    svixSignature: req.headers.get("svix-signature"),
  };
}

function decodeSecret(secret: string): Buffer {
  const stripped = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Buffer.from(stripped, "base64");
}

export function verifyPrivyWebhookSignature(
  headers: PrivySignatureHeaders,
  rawBody: string,
  secret: string
): { valid: true } | { valid: false; reason: string } {
  const { svixId, svixTimestamp, svixSignature } = headers;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, reason: "Missing svix-id, svix-timestamp, or svix-signature header" };
  }

  const timestampNum = Number(svixTimestamp);
  if (!Number.isFinite(timestampNum)) {
    return { valid: false, reason: "Invalid svix-timestamp header" };
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampNum);
  if (ageSeconds > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { valid: false, reason: "Webhook timestamp outside of tolerance" };
  }

  let keyBytes: Buffer;
  try {
    keyBytes = decodeSecret(secret);
  } catch {
    return { valid: false, reason: "Malformed webhook secret" };
  }

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", keyBytes)
    .update(signedContent)
    .digest("base64");
  const expectedBuf = Buffer.from(expectedSignature, "base64");

  // svix-signature may contain multiple space-separated "v1,<sig>" entries
  const candidates = svixSignature
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const [version, sig] = candidate.split(",");
    if (version !== "v1" || !sig) {continue;}

    let candidateBuf: Buffer;
    try {
      candidateBuf = Buffer.from(sig, "base64");
    } catch {
      continue;
    }

    if (
      candidateBuf.length === expectedBuf.length &&
      timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      return { valid: true };
    }
  }

  return { valid: false, reason: "Signature mismatch" };
}
