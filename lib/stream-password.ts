import { createHmac, randomBytes, timingSafeEqual, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "@vercel/postgres";
import { signToken, verifyToken } from "@/lib/auth/sign-token";
import { activeKey, currentKeyring } from "@/lib/security/keyring";

const scrypt = promisify(nodeScrypt);
const HASH_BYTES = 64;
const LOCK_THRESHOLD = 5;
const LOCK_WINDOW_MINUTES = 30;
export const STREAM_PASSWORD_ACCESS_COOKIE = "stream_password_access";
export const STREAM_PASSWORD_ACCESS_SECONDS = 2 * 60 * 60;

export async function hashStreamPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, HASH_BYTES) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyStreamPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = encoded.split("$");
  if (scheme !== "scrypt" || !/^[a-f0-9]{32}$/i.test(saltHex ?? "") || !/^[a-f0-9]{128}$/i.test(hashHex ?? "")) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), HASH_BYTES) as Buffer;
  return timingSafeEqual(actual, expected);
}

export async function performDummyPasswordWork(password: string): Promise<void> {
  const salt = Buffer.from("streamfi-password-check", "utf8");
  await scrypt(password, salt, HASH_BYTES);
}

export function backoffSeconds(failedAttempts: number): number {
  if (failedAttempts < LOCK_THRESHOLD) {return 0;}
  return Math.min(900, 30 * 2 ** Math.min(failedAttempts - LOCK_THRESHOLD, 5));
}

export function hashAttemptIp(ip: string): string {
  return createHmac("sha256", activeKey(currentKeyring()).key)
    .update(`stream-password:${ip}`)
    .digest("hex");
}

export async function streamPasswordLocked(streamSessionId: string, ipHash: string): Promise<boolean> {
  const { rows } = await sql`
    SELECT next_allowed_at > now() AS locked
    FROM stream_password_attempts
    WHERE stream_session_id = ${streamSessionId}
      AND ip_hash = ${ipHash}
      AND updated_at > now() - make_interval(mins => ${LOCK_WINDOW_MINUTES})
  `;
  return rows[0]?.locked === true;
}

export async function recordWrongStreamPassword(streamSessionId: string, ipHash: string): Promise<void> {
  await sql`
    INSERT INTO stream_password_attempts
      (stream_session_id, ip_hash, attempts, first_attempt_at, updated_at)
    VALUES (${streamSessionId}, ${ipHash}, 1, now(), now())
    ON CONFLICT (stream_session_id, ip_hash) DO UPDATE SET
      attempts = CASE
        WHEN stream_password_attempts.updated_at <= now() - make_interval(mins => ${LOCK_WINDOW_MINUTES}) THEN 1
        ELSE stream_password_attempts.attempts + 1
      END,
      first_attempt_at = CASE
        WHEN stream_password_attempts.updated_at <= now() - make_interval(mins => ${LOCK_WINDOW_MINUTES}) THEN now()
        ELSE stream_password_attempts.first_attempt_at
      END,
      next_allowed_at = CASE
        WHEN stream_password_attempts.updated_at <= now() - make_interval(mins => ${LOCK_WINDOW_MINUTES}) THEN NULL
        WHEN stream_password_attempts.attempts + 1 < ${LOCK_THRESHOLD} THEN NULL
        ELSE now() + make_interval(secs => LEAST(900, 30 * power(2, LEAST(stream_password_attempts.attempts + 1 - ${LOCK_THRESHOLD}, 5)))::int)
      END,
      updated_at = now()
  `;
}

export async function clearStreamPasswordAttempts(streamSessionId: string, ipHash: string): Promise<void> {
  await sql`DELETE FROM stream_password_attempts WHERE stream_session_id = ${streamSessionId} AND ip_hash = ${ipHash}`;
}

export function createStreamPasswordGrant(creatorId: string, streamSessionId: string): string {
  return signToken({
    creatorId,
    streamSessionId,
    exp: Math.floor(Date.now() / 1000) + STREAM_PASSWORD_ACCESS_SECONDS,
    nonce: randomBytes(16).toString("hex"),
  }, currentKeyring());
}

export function hasStreamPasswordGrant(request: Request, creatorId: string, streamSessionId: string): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader.split(";").map(part => part.trim()).find(part => part.startsWith(`${STREAM_PASSWORD_ACCESS_COOKIE}=`));
  if (!cookie) {return false;}
  const token = decodeURIComponent(cookie.slice(STREAM_PASSWORD_ACCESS_COOKIE.length + 1));
  const claims = verifyToken<{ creatorId: string; streamSessionId: string }>(token, currentKeyring());
  return claims?.creatorId === creatorId && claims.streamSessionId === streamSessionId;
}