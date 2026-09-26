/**
 * POST /api/routes-f/subscription-refund-request (#1426)
 * GET  /api/routes-f/subscription-refund-request?subscriptionId=... — status
 *
 * Files a refund request for a subscription payment. This never reverses the
 * original Stellar transaction — see lib/subscriptions/refund-policy.ts for
 * the eligibility policy and lib/routes-f/payouts.ts for how creator payouts
 * are recorded. A refund request within the policy window whose creator has
 * taken no payout since the subscription started is auto-approved and will
 * be funded by clawing back the not-yet-paid-out creator balance; any other
 * case (outside the window, or a payout already occurred) is routed to
 * manual admin review and, if approved, funded by the platform instead.
 *
 * Duplicate protection: subscription_refund_requests has a unique index on
 * subscription_id, so only one request can ever exist per paid period.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import {
  executeIdempotent,
  IDEMPOTENT_OPERATIONS,
} from "@/lib/idempotency/execute";
import { evaluateRefundEligibility } from "@/lib/subscriptions/refund-policy";
import { recordWorkflowEvent } from "@/lib/audit/workflow-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  subscriptionId: z.string().uuid("subscriptionId must be a valid UUID"),
  reason: z.string().min(10).max(1000),
});

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const bodyResult = await validateBody(req, requestSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }
  const { subscriptionId, reason } = bodyResult.data;

  const { rows: subRows } = await sql`
    SELECT id, subscriber_id, creator_id, started_at, expires_at,
           payment_tx_hash, amount_usdc
    FROM subscriptions
    WHERE id = ${subscriptionId}
    LIMIT 1
  `;
  const sub = subRows[0];
  if (!sub) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 }
    );
  }
  if (sub.subscriber_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rows: existingRows } = await sql`
    SELECT id, status
    FROM subscription_refund_requests
    WHERE subscription_id = ${subscriptionId}
    LIMIT 1
  `;
  if (existingRows[0]) {
    return NextResponse.json(
      {
        error: "A refund request already exists for this subscription",
        requestId: existingRows[0].id,
        status: existingRows[0].status,
      },
      { status: 409 }
    );
  }

  // A payout is considered to have occurred if the creator has taken any
  // completed payout since this subscription started — payouts here are
  // lump-sum withdrawals of accumulated earnings, not itemized per payment,
  // so per-transaction traceability isn't possible; this is the documented,
  // explicit policy (see lib/subscriptions/refund-policy.ts) rather than an
  // invented precise linkage the data can't actually support.
  const { rows: payoutRows } = await sql`
    SELECT 1 FROM payouts
    WHERE user_id = ${sub.creator_id}
      AND status = 'completed'
      AND initiated_at >= ${sub.started_at}
    LIMIT 1
  `;
  const payoutOccurred = payoutRows.length > 0;

  const eligibility = evaluateRefundEligibility({
    subscriptionStartedAt: new Date(sub.started_at),
    payoutOccurredSincePurchase: payoutOccurred,
  });

  return executeIdempotent(
    req,
    {
      userId: session.userId,
      ...IDEMPOTENT_OPERATIONS.subscriptionRefundRequest,
      request: { subscriptionId, reason },
    },
    async () => {
      const status = eligibility.autoApprovable ? "approved" : "pending_review";

      let insertResult;
      try {
        insertResult = await sql`
          INSERT INTO subscription_refund_requests (
            subscription_id, subscriber_id, creator_id, payment_tx_hash,
            amount_usdc, reason, within_window, payout_occurred,
            funding_source, status, auto_approved, reviewed_by, reviewed_at
          ) VALUES (
            ${subscriptionId}, ${session.userId}, ${sub.creator_id}, ${sub.payment_tx_hash},
            ${sub.amount_usdc}, ${reason}, ${eligibility.withinWindow}, ${eligibility.payoutOccurred},
            ${eligibility.fundingSource}, ${status}, ${eligibility.autoApprovable},
            ${eligibility.autoApprovable ? "system:auto-approval" : null},
            ${eligibility.autoApprovable ? new Date().toISOString() : null}
          )
          RETURNING id, status, funding_source, within_window, payout_occurred
        `;
      } catch (err) {
        // Unique-index race: a concurrent request for the same subscription
        // won first.
        if (isUniqueViolation(err)) {
          const { rows } = await sql`
            SELECT id, status FROM subscription_refund_requests
            WHERE subscription_id = ${subscriptionId}
            LIMIT 1
          `;
          return NextResponse.json(
            {
              error: "A refund request already exists for this subscription",
              requestId: rows[0]?.id,
              status: rows[0]?.status,
            },
            { status: 409 }
          );
        }
        throw err;
      }

      const created = insertResult.rows[0];

      await recordWorkflowEvent({
        workflow: "refund_request",
        subjectId: created.id,
        action: "submit",
        actorType: "user",
        actorId: session.userId,
        fromState: null,
        toState: created.status,
        reason,
        metadata: {
          subscriptionId,
          fundingSource: created.funding_source,
          withinWindow: created.within_window,
          payoutOccurred: created.payout_occurred,
        },
      });

      return NextResponse.json(
        {
          requestId: created.id,
          status: created.status,
          fundingSource: created.funding_source,
          withinWindow: created.within_window,
          payoutOccurred: created.payout_occurred,
          autoApproved: eligibility.autoApprovable,
        },
        { status: 201 }
      );
    }
  );
}

const statusQuerySchema = z.object({
  subscriptionId: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const queryResult = validateQuery(req, statusQuerySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }
  const { subscriptionId } = queryResult.data;

  const { rows } = await sql`
    SELECT id, subscriber_id, status, funding_source, within_window,
           payout_occurred, decision_note, reviewed_at, completed_at, created_at
    FROM subscription_refund_requests
    WHERE subscription_id = ${subscriptionId}
    LIMIT 1
  `;
  const request = rows[0];
  if (!request) {
    return NextResponse.json({ request: null });
  }
  if (request.subscriber_id !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    request: {
      id: request.id,
      status: request.status,
      fundingSource: request.funding_source,
      withinWindow: request.within_window,
      payoutOccurred: request.payout_occurred,
      // Reviewer-only rationale never surfaces here beyond the decision note
      // meant for the subscriber; internal admin-only fields stay server-side.
      decisionNote: request.decision_note,
      reviewedAt: request.reviewed_at,
      completedAt: request.completed_at,
      createdAt: request.created_at,
    },
  });
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
