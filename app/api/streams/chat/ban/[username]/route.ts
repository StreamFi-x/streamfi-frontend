import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
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

    // Delete the ban
    const result = await sql`
      DELETE FROM chat_bans
      WHERE stream_owner = ${streamOwner}
        AND banned_user = ${username}
    `;

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Ban not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "User unbanned successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unban user error:", error);
    return NextResponse.json(
      { error: "Failed to unban user" },
      { status: 500 }
    );
  }
}
