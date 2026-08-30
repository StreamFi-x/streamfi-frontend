/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Admin User Suspension Handler
 * 
 * POST /api/routes-f/admin-user-suspend
 * 
 * Suspends a user platform-wide with a reason. The suspension is reversible.
 * 
 * Request body:
 * {
 *   userId: string;          // UUID of user to suspend
 *   action: "suspend" | "unsuspend";
 *   reason?: string;         // Reason for suspension (required for suspend)
 *   duration?: number;       // Duration in hours (optional, permanent if not provided)
 * }
 * 
 * Actions performed on suspension:
 * - Sets is_banned = true
 * - Records ban_reason and banned_at timestamp
 * - Optionally sets suspended_until for temporary suspension
 * - Closes any active streaming sessions
 * - Marks user as offline if currently live
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";
import { writeNotification } from "@/lib/notifications";

const suspendSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["suspend", "unsuspend"]),
  reason: z.string().min(1).max(500).optional(),
  duration: z.number().int().positive().max(8760).optional(), // Max 1 year (8760 hours)
});

type SuspendPayload = z.infer<typeof suspendSchema>;

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return adminUnauthorized();
    }

    // Validate request body
    const bodyResult = await validateBody(req, suspendSchema);
    if (bodyResult instanceof NextResponse) {
      return bodyResult;
    }

    const { userId, action, reason, duration } = bodyResult.data;

    // Validate reason is provided for suspension
    if (action === "suspend" && !reason) {
      return NextResponse.json(
        { error: "Reason is required for suspension" },
        { status: 400 }
      );
    }

    // Check if user exists
    const userResult = await sql`
      SELECT id, username, is_banned, is_live FROM users WHERE id = ${userId}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (action === "suspend") {
      // Calculate suspension expiration if duration is provided
      let suspendedUntil: string | null = null;
      if (duration) {
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + duration);
        suspendedUntil = expirationDate.toISOString();
      }

      // Suspend the user
      await sql`
        UPDATE users SET
          is_banned = true,
          banned_at = NOW(),
          ban_reason = ${reason},
          suspended_until = ${suspendedUntil}
        WHERE id = ${userId}
      `;

      // If user is currently live, end their stream
      if (user.is_live) {
        await sql`
          UPDATE users SET
            is_live = false,
            stream_started_at = NULL,
            current_viewers = 0
          WHERE id = ${userId}
        `;

        // Close active stream sessions
        await sql`
          UPDATE stream_sessions SET
            ended_at = NOW()
          WHERE user_id = ${userId} AND ended_at IS NULL
        `;

        console.log(`🔴 Ended active stream for suspended user: ${user.username}`);
      }

      // Send notification to user
      try {
        const durationText = duration
          ? ` for ${duration} hour${duration !== 1 ? "s" : ""}`
          : " permanently";
        
        await writeNotification(
          userId,
          "live",
          "Account Suspended",
          `Your account has been suspended${durationText}. Reason: ${reason}`
        );
      } catch (notifError) {
        console.error("Failed to send suspension notification:", notifError);
      }

      console.log(
        `✅ User suspended: ${user.username} (${userId})${duration ? ` for ${duration} hours` : " permanently"} - Reason: ${reason}`
      );

      return NextResponse.json({
        message: "User suspended successfully",
        userId,
        username: user.username,
        action: "suspend",
        reason,
        duration: duration || null,
        suspended_until: suspendedUntil,
      });
    } else {
      // Unsuspend the user
      await sql`
        UPDATE users SET
          is_banned = false,
          banned_at = NULL,
          ban_reason = NULL,
          suspended_until = NULL
        WHERE id = ${userId}
      `;

      // Send notification to user
      try {
        await writeNotification(
          userId,
          "live",
          "Account Restored",
          "Your account suspension has been lifted. Welcome back!"
        );
      } catch (notifError) {
        console.error("Failed to send unsuspension notification:", notifError);
      }

      console.log(`✅ User unsuspended: ${user.username} (${userId})`);

      return NextResponse.json({
        message: "User unsuspended successfully",
        userId,
        username: user.username,
        action: "unsuspend",
      });
    }
  } catch (error) {
    console.error("❌ Admin user suspend error:", error);
    return NextResponse.json(
      { error: "Failed to process suspension" },
      { status: 500 }
    );
  }
}

// Get suspension status for a user (admin only)
export async function GET(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession();
    if (!isAdmin) {
      return adminUnauthorized();
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT 
        id,
        username,
        is_banned,
        banned_at,
        ban_reason,
        suspended_until,
        is_live
      FROM users
      WHERE id = ${userId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    // Check if temporary suspension has expired
    let isCurrentlySuspended = user.is_banned;
    if (user.suspended_until) {
      const now = new Date();
      const suspendedUntil = new Date(user.suspended_until);
      if (now > suspendedUntil) {
        // Suspension expired - auto-unsuspend
        await sql`
          UPDATE users SET
            is_banned = false,
            banned_at = NULL,
            ban_reason = NULL,
            suspended_until = NULL
          WHERE id = ${userId}
        `;
        isCurrentlySuspended = false;
      }
    }

    return NextResponse.json({
      userId: user.id,
      username: user.username,
      is_suspended: isCurrentlySuspended,
      suspended_at: user.banned_at,
      suspension_reason: user.ban_reason,
      suspended_until: user.suspended_until,
      is_live: user.is_live,
    });
  } catch (error) {
    console.error("❌ Get suspension status error:", error);
    return NextResponse.json(
      { error: "Failed to get suspension status" },
      { status: 500 }
    );
  }
}
