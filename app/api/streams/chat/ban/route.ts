import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(req: NextRequest) {
  try {
    const { streamOwnerWallet, bannedUser, durationMinutes, reason } =
      await req.json();

    if (!streamOwnerWallet || !bannedUser) {
      return NextResponse.json(
        { error: "Stream owner wallet and banned user are required" },
        { status: 400 }
      );
    }

    // Verify requester is the stream owner
    const ownerResult = await sql`
      SELECT username FROM users WHERE wallet = ${streamOwnerWallet}
    `;

    if (ownerResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Stream owner not found" },
        { status: 404 }
      );
    }

    const streamOwner = ownerResult.rows[0].username;

    // Calculate expires_at for timeouts, null for permanent bans
    let expiresAt: string | null = null;
    if (durationMinutes && durationMinutes > 0) {
      const now = new Date();
      const expiresDate = new Date(now.getTime() + durationMinutes * 60 * 1000);
      expiresAt = expiresDate.toISOString();
    }

    // Insert or update ban record
    await sql`
      INSERT INTO chat_bans (stream_owner, banned_user, expires_at, reason)
      VALUES (${streamOwner}, ${bannedUser}, ${expiresAt}, ${reason || null})
      ON CONFLICT (stream_owner, banned_user)
      DO UPDATE SET
        banned_at = now(),
        expires_at = ${expiresAt},
        reason = ${reason || null}
    `;

    return NextResponse.json(
      {
        message: expiresAt
          ? `User timed out for ${durationMinutes} minute(s)`
          : "User banned permanently",
        bannedUser,
        expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Ban user error:", error);
    return NextResponse.json({ error: "Failed to ban user" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const streamOwnerWallet = searchParams.get("streamOwnerWallet");

    if (!streamOwnerWallet) {
      return NextResponse.json(
        { error: "Stream owner wallet is required" },
        { status: 400 }
      );
    }

    // Get stream owner username
    const ownerResult = await sql`
      SELECT username FROM users WHERE wallet = ${streamOwnerWallet}
    `;

    if (ownerResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Stream owner not found" },
        { status: 404 }
      );
    }

    const streamOwner = ownerResult.rows[0].username;

    // Get active bans (permanent or not expired)
    const bansResult = await sql`
      SELECT
        id,
        banned_user,
        banned_at,
        expires_at,
        reason
      FROM chat_bans
      WHERE stream_owner = ${streamOwner}
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY banned_at DESC
    `;

    return NextResponse.json({ bans: bansResult.rows }, { status: 200 });
  } catch (error) {
    console.error("Get bans error:", error);
    return NextResponse.json({ error: "Failed to get bans" }, { status: 500 });
  }
}
