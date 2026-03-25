import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function PATCH(req: NextRequest) {
  try {
    const { wallet, slowModeSeconds, followerOnlyChat, linkBlocking } =
      await req.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet is required" },
        { status: 400 }
      );
    }

    // Validate slow mode value
    if (
      slowModeSeconds !== undefined &&
      ![0, 3, 5, 10, 30].includes(slowModeSeconds)
    ) {
      return NextResponse.json(
        { error: "Invalid slow mode value. Must be 0, 3, 5, 10, or 30" },
        { status: 400 }
      );
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (slowModeSeconds !== undefined) {
      updates.push(`slow_mode_seconds = $${paramIndex}`);
      values.push(slowModeSeconds);
      paramIndex++;
    }

    if (followerOnlyChat !== undefined) {
      updates.push(`follower_only_chat = $${paramIndex}`);
      values.push(followerOnlyChat);
      paramIndex++;
    }

    if (linkBlocking !== undefined) {
      updates.push(`link_blocking = $${paramIndex}`);
      values.push(linkBlocking);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No settings provided to update" },
        { status: 400 }
      );
    }

    values.push(wallet);

    const query = `
      UPDATE users
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE wallet = $${paramIndex}
      RETURNING slow_mode_seconds, follower_only_chat, link_blocking
    `;

    const result = await sql.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        message: "Settings updated successfully",
        settings: {
          slowModeSeconds: result.rows[0].slow_mode_seconds,
          followerOnlyChat: result.rows[0].follower_only_chat,
          linkBlocking: result.rows[0].link_blocking,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet is required" },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT slow_mode_seconds, follower_only_chat, link_blocking
      FROM users
      WHERE wallet = ${wallet}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        settings: {
          slowModeSeconds: result.rows[0].slow_mode_seconds,
          followerOnlyChat: result.rows[0].follower_only_chat,
          linkBlocking: result.rows[0].link_blocking,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}
