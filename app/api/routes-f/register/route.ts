import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(60 * 60 * 1000, 3); // 3 attempts per IP per hour

const RESERVED = [
  "admin", "api", "dashboard", "settings", "explore",
  "browse", "onboarding", "streamfi", "support", "help",
];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

const registerSchema = z.object({
  username: z
    .string()
    .regex(USERNAME_RE, "Username must be 3–30 characters: letters, numbers, underscores only"),
  ref_code: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429 }
    );
  }

  const session = await verifySession(request);
  if (!session.ok) return session.response;

  let body: z.infer<typeof registerSchema>;
  try {
    const raw = await request.json();
    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { username, ref_code } = body;

  if (RESERVED.includes(username.toLowerCase())) {
    return NextResponse.json(
      { error: "Username is reserved and cannot be used" },
      { status: 400 }
    );
  }

  try {
    // Check uniqueness
    const { rows: existing } = await sql`
      SELECT id FROM users WHERE lower(username) = lower(${username}) AND id != ${session.userId} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }

    // Apply referral code if provided
    let referredBy: string | null = null;
    if (ref_code) {
      const { rows: refRows } = await sql`
        SELECT id FROM users WHERE referral_code = ${ref_code} LIMIT 1
      `;
      if (refRows.length > 0) {
        referredBy = refRows[0].id;
      }
    }

    // Upsert user row
    const { rows: userRows } = await sql`
      INSERT INTO users (id, username, referred_by, updated_at)
      VALUES (${session.userId}, ${username}, ${referredBy}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        username    = EXCLUDED.username,
        referred_by = COALESCE(users.referred_by, EXCLUDED.referred_by),
        updated_at  = NOW()
      RETURNING id, username
    `;

    const user = userRows[0];

    // Initialise onboarding progress (idempotent)
    await sql`
      INSERT INTO onboarding_progress (user_id, current_step, completed, created_at)
      VALUES (${session.userId}, 'profile', false, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `;

    // Apply referral reward if this is a new referral
    if (referredBy) {
      await sql`
        INSERT INTO referral_rewards (referrer_id, referred_id, created_at)
        VALUES (${referredBy}, ${session.userId}, NOW())
        ON CONFLICT DO NOTHING
      `;
    }

    // Trigger welcome email (fire-and-forget, non-blocking)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    fetch(`${baseUrl}/api/request-email-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
      body: JSON.stringify({ type: "welcome" }),
    }).catch(() => {/* non-critical */});

    return NextResponse.json(
      { user_id: user.id, username: user.username, next_step: "/onboarding" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f register POST]", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
