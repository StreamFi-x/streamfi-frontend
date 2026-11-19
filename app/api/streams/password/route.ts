import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";
import { clearStreamPasswordAttempts, createStreamPasswordGrant, hashAttemptIp, hashStreamPassword, performDummyPasswordWork, recordWrongStreamPassword, STREAM_PASSWORD_ACCESS_COOKIE, STREAM_PASSWORD_ACCESS_SECONDS, streamPasswordLocked, verifyStreamPassword } from "@/lib/stream-password";

const verifyRateLimit = createRateLimiter(60_000, 30);
function getIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

export async function PUT(request: NextRequest): Promise<Response> {
  const session = await verifySession(request);
  if (!session.ok) {return session.response;}
  let body: { password?: unknown };
  try {body = await request.json();} catch {return NextResponse.json({ error: "Invalid request" }, { status: 400 });}
  if (body.password !== null && (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128)) {
    return NextResponse.json({ error: "Password must be 8 to 128 characters, or null to disable" }, { status: 400 });
  }
  const hash = typeof body.password === "string" ? await hashStreamPassword(body.password) : null;
  const updated = await sql`
    UPDATE users SET stream_password_hash = ${hash}, updated_at = now()
    WHERE id = ${session.userId} AND (${hash}::TEXT IS NULL OR stream_privacy <> 'public')
    RETURNING id
  `;
  return updated.rows.length
    ? NextResponse.json({ enabled: hash !== null })
    : NextResponse.json({ error: "Select a private stream mode before setting a password" }, { status: 409 });
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifySession(request);
  if (!session.ok) {return session.response;}
  const { rows } = await sql`SELECT stream_password_hash IS NOT NULL AS enabled, stream_privacy FROM users WHERE id = ${session.userId}`;
  if (!rows.length) {return NextResponse.json({ error: "User not found" }, { status: 404 });}
  return NextResponse.json({ enabled: rows[0].enabled, privacy: rows[0].stream_privacy });
}

export async function POST(request: NextRequest): Promise<Response> {
  const ip = getIp(request);
  if (await verifyRateLimit(ip)) {return NextResponse.json({ error: "Unable to verify stream password" }, { status: 401 });}
  let body: { username?: unknown; password?: unknown };
  try {body = await request.json();} catch {return NextResponse.json({ error: "Unable to verify stream password" }, { status: 401 });}
  if (typeof body.username !== "string" || typeof body.password !== "string" || body.password.length > 128) {
    return NextResponse.json({ error: "Unable to verify stream password" }, { status: 401 });
  }

  const { rows } = await sql`
    SELECT u.id AS creator_id, u.stream_password_hash, s.id AS stream_session_id
    FROM users u JOIN stream_sessions s ON s.user_id = u.id
    WHERE LOWER(u.username) = LOWER(${body.username}) AND u.is_live = true AND s.ended_at IS NULL
    ORDER BY s.started_at DESC LIMIT 1
  `;
  const creator = rows[0];
  if (!creator?.stream_password_hash || !creator.stream_session_id) {
    await performDummyPasswordWork(body.password);
    return NextResponse.json({ error: "Unable to verify stream password" }, { status: 401 });
  }

  const ipHash = hashAttemptIp(ip);
  if (await streamPasswordLocked(creator.stream_session_id, ipHash)) {
    await performDummyPasswordWork(body.password);
    return NextResponse.json({ error: "Unable to verify stream password" }, { status: 401 });
  }
  if (!(await verifyStreamPassword(body.password, creator.stream_password_hash))) {
    await recordWrongStreamPassword(creator.stream_session_id, ipHash);
    return NextResponse.json({ error: "Unable to verify stream password" }, { status: 401 });
  }

  await clearStreamPasswordAttempts(creator.stream_session_id, ipHash);
  const now = Math.floor(Date.now() / 1000);
  const grant = createStreamPasswordGrant(creator.creator_id, creator.stream_session_id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STREAM_PASSWORD_ACCESS_COOKIE, grant, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: STREAM_PASSWORD_ACCESS_SECONDS });
  return response;
}