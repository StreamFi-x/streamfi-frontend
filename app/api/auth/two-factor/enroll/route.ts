import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import { sql } from "@vercel/postgres";
import { hash } from "bcryptjs";
import { verifySession } from "@/lib/auth/verify-session";
import { encryptSecret, decryptSecret } from "@/lib/security/encrypted-secrets";
import { consumeRecoveryCode, verifyTotp } from "@/lib/security/step-up";
import { randomBytes } from "node:crypto";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(15 * 60_000, 12);

const ISSUER = "StreamFi";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifySession(request);
  if (!session.ok) {return session.response;}
  if (await isRateLimited(session.userId)) {
    return NextResponse.json({ error: "Too many two-factor requests" }, { status: 429 });
  }
  const { rows } = await sql`SELECT totp_enabled FROM users WHERE id = ${session.userId}`;
  return NextResponse.json({ enabled: rows[0]?.totp_enabled === true });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await verifySession(request);
  if (!session.ok) {return session.response;}
  if (await isRateLimited(session.userId)) {
    return NextResponse.json({ error: "Too many two-factor requests" }, { status: 429 });
  }
  const { rows: currentRows } = await sql`SELECT totp_enabled FROM users WHERE id = ${session.userId}`;
  if (currentRows[0]?.totp_enabled) {
    return NextResponse.json({ error: "Disable two-factor authentication with your current factor before enrolling a new authenticator" }, { status: 409 });
  }
  const secret = authenticator.generateSecret();
  await sql`DELETE FROM totp_enrollments WHERE expires_at <= now()`;
  const { rows } = await sql`SELECT email FROM users WHERE id = ${session.userId}`;
  const label = rows[0]?.email ?? session.userId;
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  await sql`
    INSERT INTO totp_enrollments (user_id, secret_enc, expires_at)
    VALUES (${session.userId}, ${encryptSecret(secret, "TOTP")}, ${expiresAt})
    ON CONFLICT (user_id) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, expires_at = EXCLUDED.expires_at
  `;
  return NextResponse.json({ secret, otpauthUrl: authenticator.keyuri(label, ISSUER, secret) });
}

export async function PUT(request: NextRequest): Promise<Response> {
  const session = await verifySession(request);
  if (!session.ok) {return session.response;}
  if (await isRateLimited(session.userId)) {
    return NextResponse.json({ error: "Too many two-factor requests" }, { status: 429 });
  }
  let body: { code?: unknown };
  try {body = await request.json();} catch {return NextResponse.json({ error: "Invalid request" }, { status: 400 });}
  if (typeof body.code !== "string") {return NextResponse.json({ error: "Invalid code" }, { status: 400 });}
  const { rows } = await sql`
    SELECT secret_enc FROM totp_enrollments
    WHERE user_id = ${session.userId} AND expires_at > now()
  `;
  if (!rows[0]) {return NextResponse.json({ error: "Enrollment expired; start again" }, { status: 410 });}
  const secret = decryptSecret(rows[0].secret_enc, "TOTP");
  if (!authenticator.verify({ token: body.code.replace(/\s/g, ""), secret, window: 1 })) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(6).toString("hex").toUpperCase());
  await sql`UPDATE users SET totp_secret_enc = ${rows[0].secret_enc}, totp_enabled = true, totp_enrolled_at = now() WHERE id = ${session.userId}`;
  await sql`DELETE FROM step_up_recovery_codes WHERE user_id = ${session.userId}`;
  for (const code of recoveryCodes) {
    await sql`INSERT INTO step_up_recovery_codes (user_id, code_hash) VALUES (${session.userId}, ${await hash(code, 10)})`;
  }
  await sql`DELETE FROM totp_enrollments WHERE user_id = ${session.userId}`;
  return NextResponse.json({ enabled: true, recoveryCodes });
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const session = await verifySession(request);
  if (!session.ok) {return session.response;}
  if (await isRateLimited(session.userId)) {
    return NextResponse.json({ error: "Too many two-factor requests" }, { status: 429 });
  }
  let body: { code?: unknown };
  try {body = await request.json();} catch {return NextResponse.json({ error: "Invalid request" }, { status: 400 });}
  if (typeof body.code !== "string" || (!(await verifyTotp(session.userId, body.code)) && !(await consumeRecoveryCode(session.userId, body.code)))) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }
  await sql`UPDATE users SET totp_enabled = false, totp_secret_enc = NULL, totp_enrolled_at = NULL WHERE id = ${session.userId}`;
  await sql`DELETE FROM step_up_recovery_codes WHERE user_id = ${session.userId}`;
  return NextResponse.json({ enabled: false });
}