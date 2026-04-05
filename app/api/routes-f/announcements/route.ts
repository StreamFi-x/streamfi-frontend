import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureRoutesFSchema } from "../_lib/schema";

/**
 * Creator Announcements endpoint.
 */

// GET /api/routes-f/announcements — list announcements for authenticated user's followed creators (feed)
export async function GET(req: NextRequest) {
  try {
    await ensureRoutesFSchema();
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    // Get the creators the user is following
    const { rows: userRows } = await sql`
      SELECT following FROM users WHERE id = ${session.userId}
    `;

    if (
      userRows.length === 0 ||
      !userRows[0].following ||
      userRows[0].following.length === 0
    ) {
      return NextResponse.json({ announcements: [] });
    }

    const following = userRows[0].following;

    // Fetch announcements from those creators
    // Pinned float to top, followed by descending creation time
    const { rows } = await sql`
      SELECT a.id, u.username, u.avatar, a.body, a.pinned, a.created_at
      FROM announcements a
      JOIN users u ON a.creator_id = u.id
      WHERE a.creator_id = ANY(${following})
      ORDER BY a.pinned DESC, a.created_at DESC
      LIMIT 20
    `;

    return NextResponse.json({ announcements: rows });
  } catch (error) {
    console.error("Announcements GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/routes-f/announcements — creator posts an announcement
export async function POST(req: NextRequest) {
  try {
    await ensureRoutesFSchema();
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    const { body, pinned } = await req.json();

    if (!body || body.length > 500) {
      return NextResponse.json(
        { error: "Body must be between 1 and 500 characters" },
        { status: 400 }
      );
    }

    // Max 1 pinned announcement per creator
    if (pinned) {
      await sql`
        UPDATE announcements SET pinned = false WHERE creator_id = ${session.userId} AND pinned = true
      `;
    }

    const { rows } = await sql`
      INSERT INTO announcements (creator_id, body, pinned)
      VALUES (${session.userId}, ${body}, ${pinned || false})
      RETURNING *
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Announcements POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
