import crypto from "crypto";

/**
 * Mint a Mux signed-playback JWT for private streams.
 *
 * Required env vars (from Mux dashboard, available on Mux Pro+):
 *   - MUX_SIGNING_KEY_ID    (the "kid" — short opaque key id)
 *   - MUX_SIGNING_KEY_PRIVATE   (the RSA private key in base64-encoded PEM)
 *
 * Returns null when keys are not configured — caller should handle gracefully
 * (e.g., fall back to public playback or surface a config error).
 */
export function mintPlaybackToken(
  playbackId: string,
  options?: {
    audience?: "v" | "t" | "g"; // v=video, t=thumbnail, g=gif
    ttlSeconds?: number;
  }
): string | null {
  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const keyPrivateB64 = process.env.MUX_SIGNING_KEY_PRIVATE;

  if (!keyId || !keyPrivateB64) {
    console.warn(
      "[mux/playback-token] Signing keys not configured — cannot mint signed JWT"
    );
    return null;
  }

  let pem: string;
  try {
    pem = Buffer.from(keyPrivateB64, "base64").toString("utf-8");
  } catch (err) {
    console.error(
      "[mux/playback-token] Failed to decode MUX_SIGNING_KEY_PRIVATE:",
      err
    );
    return null;
  }

  const audience = options?.audience ?? "v";
  const ttl = options?.ttlSeconds ?? 60 * 60 * 6; // 6 hours by default

  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: keyId,
  };

  const payload = {
    sub: playbackId,
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + ttl,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(pem);
    const signatureB64 = base64urlBuffer(signature);
    return `${signingInput}.${signatureB64}`;
  } catch (err) {
    console.error("[mux/playback-token] Sign failed:", err);
    return null;
  }
}

function base64url(input: string): string {
  return base64urlBuffer(Buffer.from(input, "utf-8"));
}

function base64urlBuffer(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function isSigningConfigured(): boolean {
  return !!process.env.MUX_SIGNING_KEY_ID && !!process.env.MUX_SIGNING_KEY_PRIVATE;
}
