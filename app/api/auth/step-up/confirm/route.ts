import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { consumeRecoveryCode, verifyTotp } from "@/lib/security/step-up";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(15 * 60_000, 20);

export async function POST(request: NextRequest): Promise<Response> {
  const session = await verifySession(request);
  if (!session.ok) {return session.response;}
  if (await isRateLimited(session.userId)) {
    return NextResponse.json({ error: "Too many verification attempts" }, { status: 429 });
  }
  let body: { challengeId?: unknown; code?: unknown };
  try {body = await request.json();} catch {return NextResponse.json({ error: "Invalid request" }, { status: 400 });}
  if (typeof body.challengeId !== "string" || typeof body.code !== "string") {
    return NextResponse.json({ error: "Invalid challenge" }, { status: 400 });
  }
  const { rows } = await sql`
    SELECT id, failed_attempts FROM step_up_challenges
    WHERE id = ${body.challengeId} AND user_id = ${session.userId}
      AND verified_at IS NULL AND consumed_at IS NULL AND expires_at > now() AND failed_attempts < 5
  `;
  if (!rows[0]) {return NextResponse.json({ error: "Challenge expired or unavailable" }, { status: 410 });}

  let valid = await verifyTotp(session.userId, body.code);
  if (!valid) {
    valid = await consumeRecoveryCode(session.userId, body.code);
  }
  if (!valid) {
    await sql`UPDATE step_up_challenges SET failed_attempts = failed_attempts + 1 WHERE id = ${body.challengeId} AND verified_at IS NULL`;
    return NextResponse.json({ error: "Invalid verification code" }, { status: 401 });
  }
  const verified = await sql`UPDATE step_up_challenges SET verified_at = now() WHERE id = ${body.challengeId} AND verified_at IS NULL AND consumed_at IS NULL RETURNING id`;
  if (!verified.rows.length) {return NextResponse.json({ error: "Challenge unavailable" }, { status: 409 });}
  return NextResponse.json({ ok: true });
}