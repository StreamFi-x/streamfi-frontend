/**
 * CSRF Protection Utilities (#1387)
 *
 * Provides double-submit CSRF token pattern for state-changing operations.
 * Uses synchronizer token pattern: server generates tokens, validates on request.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

const CSRF_TOKEN_LENGTH = 32; // bytes
const CSRF_SECRET = process.env.CSRF_SECRET || "dev-csrf-secret-change-in-production";

/**
 * Generate a cryptographically random CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString("base64url");
}

/**
 * Hash a CSRF token with the secret for storage/validation
 */
function hashToken(token: string): string {
  return createHash("sha256")
    .update(`${CSRF_SECRET}:${token}`)
    .digest("hex");
}

/**
 * Validate a CSRF token against a stored hash
 * Uses constant-time comparison to prevent timing attacks
 */
export function validateCsrfToken(token: string, storedHash: string): boolean {
  const expected = hashToken(token);
  try {
    const tokenBuf = Buffer.from(expected, "hex");
    const storedBuf = Buffer.from(storedHash, "hex");
    if (tokenBuf.length !== storedBuf.length) {
      return false;
    }
    return timingSafeEqual(tokenBuf, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Extract CSRF token from request headers
 * Looks for common header names: x-csrf-token, x-xsrf-token
 */
export function extractCsrfTokenFromRequest(req: {
  headers: { get(name: string): string | null };
}): string | null {
  return (
    req.headers.get("x-csrf-token") ||
    req.headers.get("x-xsrf-token") ||
    null
  );
}

/**
 * CSRF token that can be stored in session or cache
 */
export interface CsrfTokenPair {
  /** The raw token sent to client (in header or cookie) */
  token: string;
  /** The hashed token stored server-side */
  hash: string;
}

/**
 * Generate a new CSRF token pair
 */
export function createCsrfTokenPair(): CsrfTokenPair {
  const token = generateCsrfToken();
  return {
    token,
    hash: hashToken(token),
  };
}

/**
 * Routes that should be exempt from CSRF validation
 * (webhooks, public endpoints, etc.)
 */
export const CSRF_EXEMPT_ROUTES = new Set([
  "/api/webhooks",
  "/api/routes-f/webhooks",
  "/api/auth/session", // Privy token exchange
  "/api/auth/wallet-session", // Wallet session creation
]);

/**
 * Check if a route should be exempt from CSRF validation
 */
export function isCsrfExemptRoute(pathname: string): boolean {
  return Array.from(CSRF_EXEMPT_ROUTES).some(route => pathname.startsWith(route));
}