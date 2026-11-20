import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";
import { writeTemplatedNotification } from "@/lib/notifications";
import { shouldSendInAppNotification } from "@/lib/notifications/preferences";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { invalidateFollowCaches } from "@/lib/cache/invalidation";
import {
  apiBadRequest,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
} from "@/lib/api";

// 30 follow/unfollow actions per IP per minute
const isRateLimited = createRateLimiter(60_000, 30);

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return apiRateLimited("Too many requests", { retryAfterSeconds: 60 });
  }

  // Determine caller from server-side session — never trust client-supplied identity.
  // This prevents stale sessionStorage on account switch from acting as the wrong user.
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { receiverUsername, action } = await req.json();

  if (!receiverUsername || !["follow", "unfollow"].includes(action)) {
    return apiBadRequest("receiverUsername and valid action are required");
  }

  const callerId = session.userId;

  try {
    const [{ rows: receiverRows }, { rows: callerRows }] = await Promise.all([
      sql`SELECT id FROM users WHERE LOWER(username) = ${receiverUsername.toLowerCase()} AND deleted_at IS NULL`,
      sql`SELECT username FROM users WHERE id = ${callerId} AND deleted_at IS NULL`,
    ]);

    if (receiverRows.length === 0) {
      return apiNotFound("User not found");
    }

    const receiverId = receiverRows[0].id;
    const callerUsername: string = callerRows[0]?.username ?? "Someone";

    // UUID-level self-follow guard — unambiguous regardless of username casing
    if (callerId === receiverId) {
      return apiBadRequest("You cannot follow or unfollow yourself.");
    }

    if (action === "follow") {
      const followResult = await sql`
        INSERT INTO user_follows (follower_id, followee_id)
        VALUES (${callerId}, ${receiverId})
        ON CONFLICT DO NOTHING
      `;
      await invalidateFollowCaches(callerId, receiverId);

      try {
        await evaluateAndAwardBadges(receiverId);
      } catch (badgeErr) {
        // eslint-disable-next-line no-console
        console.error("[follow] badge evaluation failed:", badgeErr);
      }

      // Write notification only if this follow was newly created (not a retried/duplicate click)
      if (followResult.rowCount > 0) {
        try {
          // Check if user has follow notifications enabled
          const shouldSend = await shouldSendInAppNotification(
            receiverId,
            "follow",
            { sql }
          );
          if (shouldSend) {
            const idempotencyKey = `follow:${callerId}:${receiverId}:${Math.floor(Date.now() / 60000)}`;
            await writeTemplatedNotification(
              receiverId,
              "follow",
              { actor: callerUsername },
              { sql },
              "en",
              { idempotencyKey }
            );
          }
        } catch (notifErr) {
          // eslint-disable-next-line no-console
          console.error("[follow] notification write failed:", notifErr);
        }
      }

      return apiSuccess(
        { action: "follow" },
        { message: "Followed successfully", legacyFlat: true }
      );
    } else {
      await sql`
        DELETE FROM user_follows
        WHERE follower_id = ${callerId} AND followee_id = ${receiverId}
      `;
      await invalidateFollowCaches(callerId, receiverId);

      return apiSuccess(
        { action: "unfollow" },
        { message: "Unfollowed successfully", legacyFlat: true }
      );
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Follow/Unfollow error:", error);
    return apiInternalError("Failed to process follow/unfollow");
  }
}
