import { evaluateRefundEligibility, REFUND_WINDOW_DAYS } from "../refund-policy";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("evaluateRefundEligibility", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("auto-approves within the window with no payout yet", () => {
    const result = evaluateRefundEligibility({
      subscriptionStartedAt: new Date(now.getTime() - 2 * DAY_MS),
      payoutOccurredSincePurchase: false,
      now,
    });
    expect(result.withinWindow).toBe(true);
    expect(result.payoutOccurred).toBe(false);
    expect(result.fundingSource).toBe("creator_earnings");
    expect(result.autoApprovable).toBe(true);
  });

  it("routes to manual review when a payout already occurred, even within window", () => {
    const result = evaluateRefundEligibility({
      subscriptionStartedAt: new Date(now.getTime() - 1 * DAY_MS),
      payoutOccurredSincePurchase: true,
      now,
    });
    expect(result.withinWindow).toBe(true);
    expect(result.payoutOccurred).toBe(true);
    expect(result.fundingSource).toBe("platform");
    expect(result.autoApprovable).toBe(false);
  });

  it("routes to manual review when outside the window, even with no payout", () => {
    const result = evaluateRefundEligibility({
      subscriptionStartedAt: new Date(now.getTime() - (REFUND_WINDOW_DAYS + 1) * DAY_MS),
      payoutOccurredSincePurchase: false,
      now,
    });
    expect(result.withinWindow).toBe(false);
    expect(result.autoApprovable).toBe(false);
    expect(result.fundingSource).toBe("creator_earnings");
  });

  it("is inclusive at exactly the window boundary", () => {
    const result = evaluateRefundEligibility({
      subscriptionStartedAt: new Date(now.getTime() - REFUND_WINDOW_DAYS * DAY_MS),
      payoutOccurredSincePurchase: false,
      now,
    });
    expect(result.withinWindow).toBe(true);
  });

  it("both outside window and payout occurred still funds from platform if ever approved", () => {
    const result = evaluateRefundEligibility({
      subscriptionStartedAt: new Date(now.getTime() - (REFUND_WINDOW_DAYS + 5) * DAY_MS),
      payoutOccurredSincePurchase: true,
      now,
    });
    expect(result.fundingSource).toBe("platform");
    expect(result.autoApprovable).toBe(false);
  });
});
