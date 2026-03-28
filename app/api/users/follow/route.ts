import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";
import { writeNotification } from "@/lib/notifications";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";

// 30 follow/unfollow actions per IP per minute
const isRateLimited = createRateLimiter(60_000, 30);

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // Determine caller from server-side session — never trust client-supplied identity.
  // This prevents stale sessionStorage on account switch from acting as the wrong user.
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { receiverUsername, action } = await req.json();

  if (!receiverUsername || !["follow", "unfollow"].includes(action)) {
    return NextResponse.json(
      { error: "receiverUsername and valid action are required" },
      { status: 400 }
    );
  }

  const callerId = session.userId;

  try {
    const [{ rows: receiverRows }, { rows: callerRows }] = await Promise.all([
      sql`SELECT id FROM users WHERE LOWER(username) = ${receiverUsername.toLowerCase()}`,
      sql`SELECT username FROM users WHERE id = ${callerId}`,
    ]);

    if (receiverRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const receiverId = receiverRows[0].id;
    const callerUsername: string = callerRows[0]?.username ?? "Someone";

    // UUID-level self-follow guard — unambiguous regardless of username casing
    if (callerId === receiverId) {
      return NextResponse.json(
        { error: "You cannot follow or unfollow yourself." },
        { status: 400 }
      );
    }

    if (action === "follow") {
      await sql`
        INSERT INTO user_follows (follower_id, followee_id)
        VALUES (${callerId}, ${receiverId})
        ON CONFLICT DO NOTHING
      `;

      try {
        await evaluateAndAwardBadges(receiverId);
      } catch (badgeErr) {
        console.error("[follow] badge evaluation failed:", badgeErr);
      }

      // Write notification — awaited so it completes before response is sent
      try {
        await writeNotification(
          receiverId,
          "follow",
          "New follower",
          `${callerUsername} started following you`
        );
      } catch (notifErr) {
        console.error("[follow] notification write failed:", notifErr);
      }

      return NextResponse.json({ message: "Followed successfully" });
    } else {
      await sql`
        DELETE FROM user_follows
        WHERE follower_id = ${callerId} AND followee_id = ${receiverId}
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
