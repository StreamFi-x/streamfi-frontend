import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { STEP_UP_ACTIONS } from "@/lib/security/step-up";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(15 * 60_000, 20);

export async function POST(request: NextRequest): Promise<Response> {
  const session = await verifySession(request);
  if (!session.ok) {return session.response;}
  if (await isRateLimited(session.userId)) {
    return NextResponse.json({ error: "Too many challenges. Try again later." }, { status: 429 });
  }
  let body: { action?: unknown; resourceId?: unknown };
  try {body = await request.json();} catch {return NextResponse.json({ error: "Invalid request" }, { status: 400 });}
  if (!STEP_UP_ACTIONS.includes(body.action as typeof STEP_UP_ACTIONS[number]) || typeof body.resourceId !== "string") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }
  const { rows: userRows } = await sql`SELECT totp_enabled FROM users WHERE id = ${session.userId}`;
  if (!userRows[0]?.totp_enabled) {return NextResponse.json({ error: "Two-factor authentication is required" }, { status: 403 });}
  await sql`DELETE FROM step_up_challenges WHERE expires_at <= now() OR consumed_at < now() - interval '1 day'`;
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { rows } = await sql`
    INSERT INTO step_up_challenges (user_id, action, resource_id, expires_at)
    VALUES (${session.userId}, ${body.action}, ${body.resourceId === "self" ? session.userId : body.resourceId}, ${expiresAt})
    RETURNING id
  `;
  return NextResponse.json({ challengeId: rows[0].id, expiresAt });
}