import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * DEV ONLY — clears all users and dependent data so you can start fresh.
 * Guarded by CLEAR_USERS_SECRET env var to prevent accidental use.
 *
 * GET /api/debug/clear-users?secret=<CLEAR_USERS_SECRET>
 */
export async function GET(req: Request) {
  const secret = process.env.CLEAR_USERS_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CLEAR_USERS_SECRET not configured" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Delete in dependency order
    await sql`DELETE FROM stream_recordings`;
    await sql`DELETE FROM stream_viewers`;
    await sql`DELETE FROM chat_messages`;
    await sql`DELETE FROM stream_sessions`;
    await sql`DELETE FROM user_follows`;
    await sql`DELETE FROM subscribers WHERE email IS NOT NULL`;
    await sql`DELETE FROM users`;

    return NextResponse.json({
      success: true,
      message: "All users and dependent data cleared.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
