import { NextRequest } from "next/server";
import { GET as getPackages } from "../packages/route";
import { POST as purchaseRoute } from "../purchase/route";
import { GET as getBalance } from "../balance/route";
import { POST as cheerRoute } from "../cheer/route";
import { GET as getPayouts, POST as postPayouts } from "../payouts/route";
import { GET as getPolicy, POST as postPolicy } from "../policy/route";
import { resetVirtualCurrencyStore, userBalances } from "../store";

function makeReq(url: string, method: string, body?: unknown, userId?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId) {
    headers["x-user-id"] = userId;
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("StreamBits Virtual Currency Subsystem", () => {
  const testViewerId = "test_user_viewer_1";
  const testCreatorId = "test_creator_streamer_1";

  beforeEach(() => {
    resetVirtualCurrencyStore();
  });

  it("lists available StreamBits bundles via GET /packages", async () => {
    const res = await getPackages();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.packages).toHaveLength(5);
    expect(data.packages[0].bits).toBe(100);
    expect(data.info).toContain("100 StreamBits equates to $1.00");
  });

  it("purchases a bits bundle and updates custodial balance", async () => {
    const res = await purchaseRoute(
      makeReq(
        "http://localhost/api/routes-f/virtual-currency/purchase",
        "POST",
        { package_id: "pkg_500", payment_tx_hash: "0xstellar_tx_hash_12345" },
        testViewerId
      )
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.balance.available_bits).toBe(500);

    // Verify balance endpoint reflects purchase
    const balRes = await getBalance(
      makeReq("http://localhost/api/routes-f/virtual-currency/balance", "GET", undefined, testViewerId)
    );
    expect(balRes.status).toBe(200);
    const balData = await balRes.json();
    expect(balData.balance.available_bits).toBe(500);
    expect(balData.recent_transactions).toHaveLength(1);
    expect(balData.recent_transactions[0].type).toBe("purchase");
  });

  it("rejects purchase with invalid package ID", async () => {
    const res = await purchaseRoute(
      makeReq(
        "http://localhost/api/routes-f/virtual-currency/purchase",
        "POST",
        { package_id: "invalid_pkg_id", payment_tx_hash: "0xtx" },
        testViewerId
      )
    );
    expect(res.status).toBe(400);
  });

  it("executes an in-stream cheer without wallet signature and credits creator atomically", async () => {
    // 1. Give viewer 1500 bits
    await purchaseRoute(
      makeReq(
        "http://localhost/api/routes-f/virtual-currency/purchase",
        "POST",
        { package_id: "pkg_1500", payment_tx_hash: "0xtx1" },
        testViewerId
      )
    );

    // 2. Viewer cheers 250 bits
    const cheerRes = await cheerRoute(
      makeReq(
        "http://localhost/api/routes-f/virtual-currency/cheer",
        "POST",
        { creator_id: testCreatorId, amount_bits: 250, message: "Hype stream!" },
        testViewerId
      )
    );
    expect(cheerRes.status).toBe(200);
    const cheerData = await cheerRes.json();
    expect(cheerData.remaining_bits).toBe(1250);
    expect(cheerData.cheer_event.badge_tier).toBe("purple"); // 100-999 is purple

    // 3. Verify creator earnings are credited ($2.50)
    const payoutRes = await getPayouts(
      makeReq("http://localhost/api/routes-f/virtual-currency/payouts", "GET", undefined, testCreatorId)
    );
    expect(payoutRes.status).toBe(200);
    const payoutData = await payoutRes.json();
    expect(payoutData.earnings.accumulated_bits).toBe(250);
    expect(payoutData.earnings.equivalent_usd).toBe(2.5);
    expect(payoutData.eligible_for_payout).toBe(false); // Below 1000 minimum
  });

  it("rejects cheer when viewer has insufficient balance", async () => {
    const cheerRes = await cheerRoute(
      makeReq(
        "http://localhost/api/routes-f/virtual-currency/cheer",
        "POST",
        { creator_id: testCreatorId, amount_bits: 500 },
        "broke_viewer_user"
      )
    );
    expect(cheerRes.status).toBe(400);
    const data = await cheerRes.json();
    expect(data.error).toMatch(/insufficient bits balance/i);
  });

  it("aggregates creator payout when above minimum threshold (1000 bits)", async () => {
    // 1. Purchase large bundle
    await purchaseRoute(
      makeReq(
        "http://localhost/api/routes-f/virtual-currency/purchase",
        "POST",
        { package_id: "pkg_5000", payment_tx_hash: "0xtx_large" },
        testViewerId
      )
    );

    // 2. Cheer 1200 bits ($12.00)
    await cheerRoute(
      makeReq(
        "http://localhost/api/routes-f/virtual-currency/cheer",
        "POST",
        { creator_id: testCreatorId, amount_bits: 1200 },
        testViewerId
      )
    );

    // 3. Creator requests payout
    const payoutPostRes = await postPayouts(
      makeReq(
        "http://localhost/api/routes-f/virtual-currency/payouts",
        "POST",
        { destination_wallet: "G_CREATOR_STELLAR_WALLET_ADDR" },
        testCreatorId
      )
    );
    expect(payoutPostRes.status).toBe(200);
    const payoutPostData = await payoutPostRes.json();
    expect(payoutPostData.payout.bits_redeemed).toBe(1200);
    expect(payoutPostData.payout.amount_usd).toBe(12);
    expect(payoutPostData.payout.status).toBe("completed");

    // 4. Verify creator balance is reset to 0 after payout
    const afterRes = await getPayouts(
      makeReq("http://localhost/api/routes-f/virtual-currency/payouts", "GET", undefined, testCreatorId)
    );
    const afterData = await afterRes.json();
    expect(afterData.earnings.accumulated_bits).toBe(0);
    expect(afterData.earnings.total_paid_out_usd).toBe(12);
  });

  it("returns platform policy and handles account closure disposition", async () => {
    // 1. Policy check
    const policyRes = await getPolicy();
    expect(policyRes.status).toBe(200);
    const policyData = await policyRes.json();
    expect(policyData.expiry_policy).toMatch(/do not expire/i);
    expect(policyData.custody_model).toMatch(/custodial reserve/i);

    // 2. Give user some bits
    await purchaseRoute(
      makeReq(
        "http://localhost/api/routes-f/virtual-currency/purchase",
        "POST",
        { package_id: "pkg_100", payment_tx_hash: "0xclosure" },
        "closing_user"
      )
    );

    // 3. User closes account
    const closeRes = await postPolicy(
      makeReq("http://localhost/api/routes-f/virtual-currency/policy", "POST", {}, "closing_user")
    );
    expect(closeRes.status).toBe(200);
    const closeData = await closeRes.json();
    expect(closeData.unused_bits).toBe(100);
    expect(closeData.status).toBe("refund_processed");

    // 4. User balance is now 0
    const finalBalance = userBalances.get("closing_user");
    expect(finalBalance?.available_bits).toBe(0);
  });

  it("rejects unauthorized access to protected virtual currency endpoints", async () => {
    const res = await cheerRoute(
      makeReq("http://localhost/api/routes-f/virtual-currency/cheer", "POST", {
        creator_id: testCreatorId,
        amount_bits: 50,
      })
    );
    expect(res.status).toBe(401);
  });
});
