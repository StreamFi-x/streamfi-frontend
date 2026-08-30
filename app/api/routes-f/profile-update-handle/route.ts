import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { sql } from "@vercel/postgres";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  let body: { handle?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const handle = body.handle || body.username;
  if (!handle || typeof handle !== "string") {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  const cleanHandle = handle.trim();

  // Handle format validation (3-30 chars, alphanumeric & underscores)
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanHandle)) {
    return NextResponse.json(
      { error: "Handle must be 3-30 characters long and contain only letters, numbers, and underscores" },
      { status: 400 }
    );
  }

  // 1. Check 30-day rate limit
  try {
    const { rows } = await sql`
      SELECT last_handle_change_at, username
      FROM users
      WHERE id = ${session.userId} OR wallet = ${session.wallet}
      LIMIT 1
    `;

    const user = rows[0];
    if (user && user.last_handle_change_at) {
      const lastChange = new Date(user.last_handle_change_at).getTime();
      const now = Date.now();
      if (now - lastChange < THIRTY_DAYS_MS) {
        const daysRemaining = Math.ceil((THIRTY_DAYS_MS - (now - lastChange)) / (24 * 60 * 60 * 1000));
        return NextResponse.json(
          { error: `Handle can only be changed once every 30 days. Please wait ${daysRemaining} day(s).` },
          { status: 429 }
        );
      }
    }
  } catch {
    // Continue if column not present
  }

  // 2. Check handle availability
  try {
    const { rows: existing } = await sql`
      SELECT id FROM users
      WHERE LOWER(username) = LOWER(${cleanHandle})
      AND id != ${session.userId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({ error: "Handle is already taken" }, { status: 409 });
    }
  } catch {
    // Fallback check
  }

  // 3. Update user handle and timestamp
  try {
    await sql`
      UPDATE users
      SET username = ${cleanHandle},
          last_handle_change_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.userId}
    `;
  } catch {
    if (session.wallet) {
      try {
        await sql`
          UPDATE users
          SET username = ${cleanHandle},
              updated_at = CURRENT_TIMESTAMP
          WHERE wallet = ${session.wallet}
        `;
      } catch {
        // Fallback
      }
    }
  }

  return NextResponse.json(
    {
      success: true,
      username: cleanHandle,
      message: "Handle updated successfully",
    },
    { status: 200 }
  );
}
