/**
 * POST /api/routes-f/auth-email-change-rollback (#1735)
 *
 * Implements rollback or bounce handling for an in-flight email change
 * on a verified account according to the email reverification state machine.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { shouldBypassAuth } from "@/lib/dev-mode";
import {
  transitionEmailVerification,
  canRollbackEmailChange,
  EmailAccountSnapshot,
} from "@/lib/auth/email-reverification";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { createSanitizedErrorResponse } from "@/lib/api/error-response";

const requestSchema = z.object({
  userId: z.string().optional(),
  action: z.enum(["rollback", "bounce"]).default("rollback"),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    let targetUserId: string | null = null;

    if (!shouldBypassAuth()) {
      const session = await verifySession(request);
      if (session.ok && session.userId) {
        targetUserId = session.userId;
      }
    }

    let body: z.infer<typeof requestSchema> = { action: "rollback" };
    try {
      const raw = await request.json();
      const parsed = requestSchema.safeParse(raw);
      if (parsed.success) {
        body = parsed.data;
        if (!targetUserId && body.userId) {
          targetUserId = body.userId;
        }
      }
    } catch {
      // Empty or non-JSON body defaults to rollback for session user
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userResult = await sql`
      SELECT id, email, emailverified, pending_email, pending_email_requested_at,
             email_change_status, email_change_failure_reason, previous_verified_email
      FROM users WHERE id = ${targetUserId} AND deleted_at IS NULL
    `;

    const userRow = userResult.rows[0];
    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const snapshot: EmailAccountSnapshot = {
      email: userRow.email,
      emailVerified: Boolean(userRow.emailverified),
      pendingEmail: userRow.pending_email,
      pendingEmailRequestedAt: userRow.pending_email_requested_at,
      emailChangeStatus: userRow.email_change_status || "none",
      emailChangeFailureReason: userRow.email_change_failure_reason,
      previousVerifiedEmail: userRow.previous_verified_email,
    };

    if (body.action === "rollback") {
      if (!canRollbackEmailChange(snapshot)) {
        return NextResponse.json(
          { error: "Cannot rollback: no pending or failed email change found" },
          { status: 400 }
        );
      }

      const transition = transitionEmailVerification(snapshot, {
        type: "ROLLBACK_CHANGE",
      });

      await sql`
        UPDATE users
        SET email = ${transition.snapshot.email},
            emailverified = ${transition.snapshot.emailVerified},
            pending_email = NULL,
            email_change_status = 'none',
            email_change_failure_reason = NULL,
            updated_at = NOW()
        WHERE id = ${targetUserId}
      `;

      await invalidateUserCaches({ id: targetUserId });

      return NextResponse.json({
        message: "Email change rolled back successfully",
        email: transition.snapshot.email,
        emailVerified: transition.snapshot.emailVerified,
      });
    }

    // action === 'bounce'
    const transition = transitionEmailVerification(snapshot, {
      type: "DELIVERY_BOUNCED",
      reason: body.reason,
    });

    await sql`
      UPDATE users
      SET email_change_status = 'failed',
          email_change_failure_reason = ${body.reason || "delivery_bounced"},
          updated_at = NOW()
      WHERE id = ${targetUserId}
    `;

    return NextResponse.json({
      message: "Recorded email delivery failure",
      status: transition.snapshot.emailChangeStatus,
      failureReason: transition.snapshot.emailChangeFailureReason,
    });
  } catch (error) {
    console.error("[auth-email-change-rollback POST]", error);
    return createSanitizedErrorResponse(error, "Failed to process email rollback");
  }
}
