/**
 * Shared helpers for the user_sessions table.
 *
 * Responsibilities:
 *  - Hash raw session tokens (SHA-256) so we never store them in plaintext
 *  - Parse a User-Agent string into a human-readable device hint
 *  - Insert a new session row on login
 *  - Validate a session token on every request (revoked / expired check)
 *  - Touch last_seen_at at most once per minute (write-amplification guard)
 *  - Mask the last octet of an IP address for privacy
 */

import { createHash } from "crypto";
import { sql } from "@vercel/postgres";

// ─── Token hashing ────────────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of a raw session token.
 * This is what we store in the DB — never the raw token.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// ─── User-Agent parsing ───────────────────────────────────────────────────────

/**
 * Produces a short, human-readable device hint from a User-Agent string.
 * Examples: "Chrome on macOS", "Safari on iPhone", "Firefox on Windows"
 */
export function parseDeviceHint(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const ua = userAgent;

  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    browser = "Chrome";
  } else if (/Firefox\//i.test(ua)) {
    browser = "Firefox";
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browser = "Safari";
  } else if (/MSIE|Trident/i.test(ua)) {
    browser = "Internet Explorer";
  }

  let os = "Unknown OS";
  if (/iPhone/i.test(ua)) {
    os = "iPhone";
  } else if (/iPad/i.test(ua)) {
    os = "iPad";
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/Windows NT/i.test(ua)) {
    os = "Windows";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  } else if (/CrOS/i.test(ua)) {
    os = "ChromeOS";
  }

  return `${browser} on ${os}`;
}

// ─── IP masking ───────────────────────────────────────────────────────────────

/**
 * Masks the last octet of an IPv4 address (e.g. "1.2.3.4" → "1.2.3.x").
 * IPv6 addresses have their last group replaced with "xxxx".
 */
export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  const v4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.x`;
  const v6parts = ip.split(":");
  if (v6parts.length > 1) {
    v6parts[v6parts.length - 1] = "xxxx";
    return v6parts.join(":");
  }
  return ip;
}

/**
 * Returns the value only if it looks like a valid IP address, otherwise null.
 * Prevents passing "unknown" or empty strings to a PostgreSQL INET column.
 */
function safeIp(ip: string | null): string | null {
  if (!ip) return null;
  // Matches IPv4 (e.g. 1.2.3.4) and IPv6 (hex digits + colons)
  return /^[\d.:a-fA-F]+$/.test(ip) ? ip : null;
}

// ─── Session row shape ────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  device_hint: string | null;
  ip_address: string | null;
  last_seen_at: string;
  created_at: string;
  /** Not stored in DB — computed by the caller based on token_hash match. */
  is_current: boolean;
}

// ─── Create session ───────────────────────────────────────────────────────────

export interface CreateSessionOptions {
  userId: string;
  rawToken: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** Seconds from now until the session expires. */
  ttlSeconds: number;
}

/**
 * Inserts a new row into user_sessions.
 * Call this immediately after setting the session cookie on login.
 */
export async function createSession(opts: CreateSessionOptions): Promise<void> {
  const tokenHash = hashToken(opts.rawToken);
  const deviceHint = parseDeviceHint(opts.userAgent);
  const ip = safeIp(opts.ipAddress); // null-safe — never passes "unknown" to INET

  // expires_at: build the interval string in JS so we don't mix a parameterized
  // number with an INTERVAL literal inside the SQL template.
  const expiresInterval = `${opts.ttlSeconds} seconds`;

  await sql`
    INSERT INTO user_sessions
      (user_id, token_hash, ip_address, user_agent, device_hint, expires_at)
    VALUES (
      ${opts.userId},
      ${tokenHash},
      ${ip}::INET,
      ${opts.userAgent},
      ${deviceHint},
      NOW() + ${expiresInterval}::INTERVAL
    )
    ON CONFLICT (token_hash) DO NOTHING
  `;
}

// ─── Validate session ─────────────────────────────────────────────────────────

export interface ValidSessionRow {
  id: string;
  user_id: string;
  last_seen_at: Date;
}

/**
 * Looks up a session by its raw token hash.
 * Returns the row if it exists, is not revoked, and has not expired.
 * Returns null otherwise.
 */
export async function findActiveSession(
  rawToken: string
): Promise<ValidSessionRow | null> {
  const tokenHash = hashToken(rawToken);

  const { rows } = await sql<ValidSessionRow>`
    SELECT id, user_id, last_seen_at
    FROM user_sessions
    WHERE token_hash = ${tokenHash}
      AND revoked    = false
      AND expires_at > NOW()
    LIMIT 1
  `;

  return rows[0] ?? null;
}

// ─── Touch last_seen_at (debounced) ───────────────────────────────────────────

/**
 * Updates last_seen_at for a session, but only if it hasn't been updated
 * within the last minute. Prevents a DB write on every single request.
 *
 * Fire-and-forget — callers should not await this unless they need the result.
 */
export async function touchSession(sessionId: string): Promise<void> {
  await sql`
    UPDATE user_sessions
    SET    last_seen_at = NOW()
    WHERE  id           = ${sessionId}
      AND  last_seen_at < NOW() - INTERVAL '1 minute'
  `;
}

// ─── Revoke helpers ───────────────────────────────────────────────────────────

/**
 * Revokes a single session by its UUID.
 * Returns true if a row was actually updated (i.e. it existed and wasn't already revoked).
 */
export async function revokeSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const { rowCount } = await sql`
    UPDATE user_sessions
    SET    revoked = true
    WHERE  id      = ${sessionId}
      AND  user_id = ${userId}
      AND  revoked = false
  `;
  return (rowCount ?? 0) > 0;
}

/**
 * Revokes all sessions for a user except the one identified by currentRawToken.
 * Returns the number of sessions revoked.
 */
export async function revokeAllOtherSessions(
  userId: string,
  currentRawToken: string
): Promise<number> {
  const currentHash = hashToken(currentRawToken);

  const { rowCount } = await sql`
    UPDATE user_sessions
    SET    revoked = true
    WHERE  user_id    = ${userId}
      AND  token_hash != ${currentHash}
      AND  revoked    = false
  `;
  return rowCount ?? 0;
}

// ─── List sessions ────────────────────────────────────────────────────────────

/**
 * Returns all active (non-revoked, non-expired) sessions for a user.
 * The caller passes the current raw token so we can mark is_current.
 */
export async function listActiveSessions(
  userId: string,
  currentRawToken: string
): Promise<SessionRow[]> {
  const currentHash = hashToken(currentRawToken);

  const { rows } = await sql`
    SELECT
      id,
      device_hint,
      ip_address::TEXT AS ip_address,
      last_seen_at,
      created_at,
      token_hash
    FROM user_sessions
    WHERE  user_id    = ${userId}
      AND  revoked    = false
      AND  expires_at > NOW()
    ORDER BY last_seen_at DESC
  `;

  return rows.map((r) => ({
    id: r.id as string,
    device_hint: (r.device_hint as string | null) ?? null,
    ip_address: maskIp(r.ip_address as string | null),
    last_seen_at: (r.last_seen_at as Date).toISOString(),
    created_at: (r.created_at as Date).toISOString(),
    is_current: r.token_hash === currentHash,
  }));
}
