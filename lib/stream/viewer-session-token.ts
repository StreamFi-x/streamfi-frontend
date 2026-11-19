/**
 * #725: server-issued, unforgeable viewer-session tokens.
 *
 * Before this, app/api/streams/viewers accepted an arbitrary, client-supplied
 * `sessionId` string on POST/PATCH/DELETE. Anyone could POST a fresh random
 * UUID on every request to inflate `current_viewers`/`total_views` without
 * bound, or DELETE with a guessed id to sabotage a competitor's count. Anonymous
 * viewing must keep working, so a full `verifySession` gate is not an option.
 *
 * Instead the watch page mints a signed token on first load (GET on the viewers
 * route); the token binds a random, server-generated session id (`sid`) to the
 * stream it belongs to (`pid`, the Mux playback id). Every subsequent write must
 * present that token, so a client can no longer choose its own session id, and
 * a token minted for one stream cannot be replayed against another.
 *
 * Signed with the same HMAC keyring as other server-issued grants (see
 * lib/stream-password.ts) and given a bounded lifetime so leaked tokens expire.
 */

import { randomUUID } from "node:crypto";
import { signToken, verifyToken } from "@/lib/auth/sign-token";
import { currentKeyring } from "@/lib/security/keyring";

/** Viewer sessions are long-lived (a watch page can stay open all day). */
export const VIEWER_SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface ViewerSessionClaims {
  /** Server-generated viewer session id — never client-chosen. */
  sid: string;
  /** Mux playback id the session is bound to. */
  pid: string;
  /** Issued-at / expiry, unix seconds. */
  iat: number;
  exp: number;
}

export interface ViewerSession {
  sessionId: string;
  token: string;
  expiresAt: number;
}

/**
 * Mint a viewer session bound to a stream. `sessionId` is the server-generated
 * id the client must echo back on join/leave/heartbeat; it is embedded in the
 * token, so the client cannot substitute its own.
 */
export function createViewerSession(playbackId: string): ViewerSession {
  const now = Math.floor(Date.now() / 1000);
  const sid = randomUUID();
  const claims: ViewerSessionClaims = {
    sid,
    pid: playbackId,
    iat: now,
    exp: now + VIEWER_SESSION_TTL_SECONDS,
  };
  const token = signToken(claims, currentKeyring());
  return { sessionId: sid, token, expiresAt: claims.exp };
}

/**
 * Verify a viewer-session token, optionally asserting it is bound to a given
 * stream (`playbackId`) and/or session id (`sessionId`). Returns the claims on
 * success, or null on malformed/expired/forged/mismatched tokens.
 */
export function verifyViewerSessionToken(
  token: unknown,
  expected: { playbackId?: string; sessionId?: string } = {}
): ViewerSessionClaims | null {
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }

  let claims: ViewerSessionClaims | null;
  try {
    claims = verifyToken<ViewerSessionClaims>(token, currentKeyring());
  } catch {
    // Keyring misconfigured (e.g. SESSION_SECRET unset) — treat as unauthorized
    // rather than surfacing a 500 to callers who simply lack a valid token.
    return null;
  }

  if (
    !claims ||
    typeof claims.sid !== "string" ||
    typeof claims.pid !== "string" ||
    claims.sid.length === 0 ||
    claims.pid.length === 0
  ) {
    return null;
  }

  if (expected.playbackId && claims.pid !== expected.playbackId) {
    return null;
  }
  if (expected.sessionId && claims.sid !== expected.sessionId) {
    return null;
  }
  return claims;
}
