/**
 * Refund policy for subscription payments (#1426).
 *
 * Payments here are Stellar transactions, not reversible card charges: a
 * "refund" is the platform originating a new, separate outbound payment, not
 * a reversal of the original transaction. This module holds every eligibility
 * rule in one place so it isn't decided ad hoc per request or scattered across
 * route handlers and components.
 *
 * Policy (documented here because the project has not defined one elsewhere):
 *  - A refund request must be filed within REFUND_WINDOW_DAYS of the
 *    subscription's started_at.
 *  - Requests filed within the window, for a period whose creator has not
 *    taken any payout since the subscription started, are auto-approved and
 *    funded by clawing back from the not-yet-paid-out creator balance
 *    (funding_source = 'creator_earnings').
 *  - Requests filed within the window where a payout HAS already occurred, or
 *    filed after the window at all, always go to manual admin review
 *    (funding_source = 'platform' if approved) — the platform pays it, the
 *    creator's already-paid-out earnings are never clawed back automatically.
 *  - At most one refund request may exist per subscription period, whatever
 *    its outcome (enforced by a unique index in the migration).
 */

export const REFUND_WINDOW_DAYS = 7;

export type RefundFundingSource = "creator_earnings" | "platform";

export interface RefundEligibilityInput {
  subscriptionStartedAt: Date;
  /** Whether the creator has taken a completed payout since the subscription started. */
  payoutOccurredSincePurchase: boolean;
  now?: Date;
}

export interface RefundEligibility {
  withinWindow: boolean;
  payoutOccurred: boolean;
  fundingSource: RefundFundingSource;
  /** True only when the request can skip manual review entirely. */
  autoApprovable: boolean;
}

export function evaluateRefundEligibility(
  input: RefundEligibilityInput
): RefundEligibility {
  const now = input.now ?? new Date();
  const windowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const withinWindow =
    now.getTime() - input.subscriptionStartedAt.getTime() <= windowMs;
  const payoutOccurred = input.payoutOccurredSincePurchase;

  return {
    withinWindow,
    payoutOccurred,
    fundingSource: payoutOccurred ? "platform" : "creator_earnings",
    autoApprovable: withinWindow && !payoutOccurred,
  };
}
