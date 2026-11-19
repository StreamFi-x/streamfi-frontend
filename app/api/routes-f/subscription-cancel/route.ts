/**
 * POST /api/routes-f/subscription-cancel (#1426)
 *
 * Cancels auto-renewal for a subscription. This does NOT revoke access or
 * touch funds: the subscription is a one-time, time-bounded Stellar payment
 * (see db/migrations/add-stream-privacy-and-subs.sql) with no recurring
 * on-chain billing to stop — "cancel" means the platform will not create a
 * new subscription row when this one expires, and the subscriber keeps
 * access through expires_at exactly as already paid for.
 *
 * Idempotent: cancelling an already-cancelled subscription returns the same
 * success response instead of erroring, so retries/double-clicks/refreshes
 * never produce contradictory state.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { sql } from "@vercel/postgres";
import {
  executeIdempotent,
  IDEMPOTENT_OPERATIONS,
} from "@/lib/idempotency/execute";
import { recordWorkflowEvent } from "@/lib/audit/workflow-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cancelSchema = z.object({
  subscriptionId: z.string().uuid("subscriptionId must be a valid UUID"),
});

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const bodyResult = await validateBody(req, cancelSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }
  const { subscriptionId } = bodyResult.data;

  const { rows } = await sql`
    SELECT id, subscriber_id, expires_at, status, renewal_cancelled_at
    FROM subscriptions
    WHERE id = ${subscriptionId}
    LIMIT 1
  `;
  const sub = rows[0];

  if (!sub) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 }
    );
  }
  if (sub.subscriber_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return executeIdempotent(
    req,
    {
      userId: session.userId,
      ...IDEMPOTENT_OPERATIONS.subscriptionCancel,
      request: { subscriptionId },
    },
    async () => {
      // Already cancelled: report the same outcome instead of erroring, so a
      // duplicate click, refresh, or retried request is a no-op.
      if (sub.renewal_cancelled_at || sub.status === "cancelled") {
        return NextResponse.json({
          success: true,
          subscriptionId,
          status: "renewal_cancelled",
          accessUntil: sub.expires_at,
          alreadyCancelled: true,
        });
      }

      const { rows: updated } = await sql`
        UPDATE subscriptions
        SET renewal_cancelled_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${subscriptionId}
        RETURNING expires_at
      `;

      await recordWorkflowEvent({
        workflow: "subscription",
        subjectId: subscriptionId,
        action: "cancel_renewal",
        actorType: "user",
        actorId: session.userId,
        fromState: sub.status,
        toState: sub.status,
        metadata: { expires_at: updated[0]?.expires_at ?? sub.expires_at },
      });

      return NextResponse.json({
        success: true,
        subscriptionId,
        status: "renewal_cancelled",
        accessUntil: updated[0]?.expires_at ?? sub.expires_at,
        alreadyCancelled: false,
      });
    }
  );
}
