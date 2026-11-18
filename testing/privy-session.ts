/**
 * Test helper for the HMAC-signed `privy_session` cookie (#1858).
 *
 * verifySession no longer accepts a bare `did:privy:...` value, so tests that
 * need an authenticated Privy user mint a real signed token here instead of
 * hand-writing a cookie.
 */
import { signToken } from "@/lib/auth/sign-token";
import { currentKeyring } from "@/lib/security/keyring";

export const TEST_SESSION_SECRET = "test-session-secret-0123456789abcdef";

/** Make sure a signing key is configured; never overrides one a test set. */
export function ensureTestSessionSecret(): void {
  if (!process.env.SESSION_KEYRING_JSON && !process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  }
}

export interface SignedPrivySessionOptions {
  /** Token lifetime in seconds from `issuedAt`. Negative values mint an already-expired token. */
  ttlSeconds?: number;
  /** Unix seconds. Defaults to now. */
  issuedAt?: number;
}

/** Returns a signed `privy_session` cookie value for the given Privy DID. */
export function signedPrivySession(
  privyId = "did:privy:user",
  { ttlSeconds = 3600, issuedAt }: SignedPrivySessionOptions = {}
): string {
  ensureTestSessionSecret();
  const iat = issuedAt ?? Math.floor(Date.now() / 1000);
  return signToken({ privyId, iat, exp: iat + ttlSeconds }, currentKeyring());
}
