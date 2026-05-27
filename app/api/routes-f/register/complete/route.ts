import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

const completeSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  bio: z.string().max(300).optional(),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  let body: z.infer<typeof completeSchema>;
  try {
    const raw = await request.json();
    const parsed = completeSchema.safeParse(raw);
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

  try {
    // Verify user has completed /register first
    const { rows: userRows } = await sql`
      SELECT id, username FROM users WHERE id = ${session.userId} AND username IS NOT NULL LIMIT 1
    `;
    if (userRows.length === 0) {
      return NextResponse.json(
        { error: "Complete /api/routes-f/register before calling /complete" },
        { status: 400 }
      );
    }

    const { display_name, bio, avatar_url } = body;

    await sql`
      UPDATE users
      SET display_name = COALESCE(${display_name ?? null}, display_name),
          bio          = COALESCE(${bio ?? null}, bio),
          avatar_url   = COALESCE(${avatar_url || null}, avatar_url),
          updated_at   = NOW()
      WHERE id = ${session.userId}
    `;

    // Mark onboarding as completed
    await sql`
      UPDATE onboarding_progress
      SET current_step = 'done',
          completed    = true,
          updated_at   = NOW()
      WHERE user_id = ${session.userId}
    `;

    // Seed welcome badge (idempotent)
    await sql`
      INSERT INTO user_badges (user_id, badge_slug, earned_at)
      VALUES (${session.userId}, 'early-adopter', NOW())
      ON CONFLICT (user_id, badge_slug) DO NOTHING
    `;

    // Welcome notification
    await sql`
      INSERT INTO notifications (user_id, type, title, body, is_read, created_at)
      VALUES (
        ${session.userId},
        'system',
        'Welcome to StreamFi!',
        'Your account is ready. Start streaming or explore live channels.',
        false,
        NOW()
      )
    `;

    return NextResponse.json({ completed: true, next_step: "/dashboard" });
  } catch (error) {
    console.error("[routes-f register/complete POST]", error);
    return NextResponse.json({ error: "Failed to complete registration" }, { status: 500 });
  }
}
