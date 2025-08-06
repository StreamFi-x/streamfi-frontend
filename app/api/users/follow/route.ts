import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(req: NextRequest) {
  const { callerUsername, receiverUsername, action } = await req.json();

  if (
    !callerUsername ||
    !receiverUsername ||
    !["follow", "unfollow"].includes(action)
  ) {
    return NextResponse.json(
      {
        error:
          "callerUsername, receiverUsername, and valid action are required",
      },
      { status: 400 }
    );
  }

  if (callerUsername === receiverUsername) {
    return NextResponse.json(
      { error: "You cannot follow or unfollow yourself." },
      { status: 400 }
    );
  }

  try {
    // Fetch user UUIDs by username
    const { rows: callerRows } =
      await sql`SELECT id FROM users WHERE username = ${callerUsername}`;
    const { rows: receiverRows } =
      await sql`SELECT id FROM users WHERE username = ${receiverUsername}`;

    if (callerRows.length === 0 || receiverRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const callerId = callerRows[0].id;
    const receiverId = receiverRows[0].id;

    if (action === "follow") {
      // Add receiver to caller's following
      await sql`
        UPDATE users
        SET following = ARRAY(
          SELECT DISTINCT unnest(COALESCE(following, '{}'))::UUID
          UNION SELECT ${receiverId}::UUID
        )
        WHERE id = ${callerId}
      `;

      // Add caller to receiver's followers
      await sql`
        UPDATE users
        SET followers = ARRAY(
          SELECT DISTINCT unnest(COALESCE(followers, '{}'))::UUID
          UNION SELECT ${callerId}::UUID
        )
        WHERE id = ${receiverId}
      `;

      return NextResponse.json({ message: "Followed successfully" });
    } else {
      // Remove receiver from caller's following
      await sql`
        UPDATE users
        SET following = ARRAY(
          SELECT unnest(COALESCE(following, '{}'))::UUID
          EXCEPT SELECT ${receiverId}::UUID
        )
        WHERE id = ${callerId}
      `;

      // Remove caller from receiver's followers
      await sql`
        UPDATE users
        SET followers = ARRAY(
          SELECT unnest(COALESCE(followers, '{}'))::UUID
          EXCEPT SELECT ${callerId}::UUID
        )
        WHERE id = ${receiverId}
      `;

      return NextResponse.json({ message: "Unfollowed successfully" });
    }
  } catch (error) {
    console.error("Follow/Unfollow error:", error);
    return NextResponse.json(
      { error: "Failed to process follow/unfollow" },
      { status: 500 }
    );
  }
}
