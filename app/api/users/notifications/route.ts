import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(req: NextRequest) {
  const { username, title, text } = await req.json();

  if (!username || !title || !text) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    const { rows } =
      await sql`SELECT * FROM users WHERE username = ${username}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const notification = { title, text };

    await sql`
      UPDATE users
      SET notifications = COALESCE(notifications, '{}') || ${JSON.stringify(notification)}::jsonb
      WHERE username = ${username}
    `;

    return NextResponse.json({ message: "Notification added successfully" });
  } catch (error) {
    console.error("Notification error:", error);
    return NextResponse.json(
      { error: "Failed to add notification" },
      { status: 500 }
    );
  }
}

// example post request
// {
//     "username": "streamer01",
//     "title": "New Stream",
//     "text": "You just went live!"
//   }
