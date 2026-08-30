/**
 * Structural verification for a Google Identity Services credential
 * (a Google-issued OAuth/OpenID ID token — a JWT signed by Google).
 *
 * NOTE: This decodes and sanity-checks the token's claims (issuer, audience
 * presence, subject, expiry) but does NOT cryptographically verify Google's
 * RS256 signature against Google's rotating JWKS — this repo has no JWKS/
 * `google-auth-library` dependency yet. In production this should be swapped
 * for full signature verification (e.g. `google-auth-library`'s
 * `OAuth2Client.verifyIdToken`) before this endpoint is trusted with real
 * account-linking traffic. Documented as a known limitation.
 */

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export interface GoogleCredentialClaims {
  /** Stable, unique Google account identifier. */
  sub: string;
  /** Verified email address associated with the Google account, if present. */
  email: string | null;
  emailVerified: boolean;
}

export type GoogleCredentialResult =
  | { ok: true; claims: GoogleCredentialClaims }
  | { ok: false; error: string };

function base64UrlDecode(segment: string): string {
  return Buffer.from(segment, "base64url").toString("utf8");
}

export function verifyGoogleCredential(credential: unknown): GoogleCredentialResult {
  if (typeof credential !== "string" || credential.trim().length === 0) {
    return { ok: false, error: "credential is required" };
  }

  const parts = credential.split(".");
  if (parts.length !== 3) {
    return { ok: false, error: "Invalid Google credential format" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return { ok: false, error: "Invalid Google credential format" };
  }

  const { iss, sub, aud, exp, email, email_verified } = payload as Record<string, unknown>;

  if (typeof iss !== "string" || !GOOGLE_ISSUERS.has(iss)) {
    return { ok: false, error: "Credential was not issued by Google" };
  }

  if (typeof sub !== "string" || sub.trim().length === 0) {
    return { ok: false, error: "Credential is missing a subject (sub) claim" };
  }

  if (typeof aud !== "string" || aud.trim().length === 0) {
    return { ok: false, error: "Credential is missing an audience (aud) claim" };
  }

  if (typeof exp !== "number" || Math.floor(Date.now() / 1000) > exp) {
    return { ok: false, error: "Credential has expired" };
  }

  return {
    ok: true,
    claims: {
      sub,
      email: typeof email === "string" ? email : null,
      emailVerified: email_verified === true,
    },
  };
}
