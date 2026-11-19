import { Horizon } from "@stellar/stellar-sdk";
import {
  calculateMinimumReserveStroops,
  calculateSpendableBalance,
  getBalanceInfo,
} from "../reserve";

/**
 * Create a mock Stellar account with specified balance and subentry count.
 */
function createMockAccount(
  balance: string,
  subentryCount: number = 0
): Horizon.AccountResponse {
  return {
    id: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    account_id: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    balances: [
      {
        balance,
        asset_type: "native",
        // Other fields omitted for brevity
      } as any,
    ],
    subentry_count: subentryCount,
    // Other required fields omitted, using any to avoid type exhaustion
  } as Horizon.AccountResponse;
}

describe("Stellar Reserve Calculations", () => {
  describe("calculateMinimumReserveStroops", () => {
    it("returns 2 XLM (20M stroops) for an account with no subentries", () => {
      const account = createMockAccount("100", 0);
      const reserve = calculateMinimumReserveStroops(account);
      expect(reserve).toBe(2_000_000); // 2 XLM in stroops
    });

    it("adds 0.5 XLM per trustline/entry", () => {
      const account = createMockAccount("100", 1);
      const reserve = calculateMinimumReserveStroops(account);
      expect(reserve).toBe(2_500_000); // 2 XLM + 0.5 XLM
    });

    it("correctly handles multiple subentries", () => {
      // Account with 3 trustlines + 1 offer = 4 subentries
      const account = createMockAccount("100", 4);
      const reserve = calculateMinimumReserveStroops(account);
      expect(reserve).toBe(4_000_000); // 2 XLM + (4 * 0.5) XLM
    });

    it("handles account with many trustlines", () => {
      // Account with 10 trustlines
      const account = createMockAccount("100", 10);
      const reserve = calculateMinimumReserveStroops(account);
      expect(reserve).toBe(7_000_000); // 2 XLM + (10 * 0.5) XLM
    });
  });

  describe("calculateSpendableBalance", () => {
    it("returns 0 for unfunded account", () => {
      const account = createMockAccount("0", 0);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("0");
    });

    it("subtracts base reserve from raw balance", () => {
      // 10 XLM raw, 2 XLM base reserve = 8 XLM spendable
      const account = createMockAccount("10.0000000", 0);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("8.0000000");
    });

    it("accounts for trustline entries in reserve", () => {
      // 10 XLM raw, 2 XLM base + 0.5 XLM per trustline (1 trustline) = 7.5 XLM spendable
      const account = createMockAccount("10.0000000", 1);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("7.5000000");
    });

    it("returns 0 when balance is below reserve", () => {
      // 1 XLM raw, 2 XLM base reserve = negative, clamped to 0
      const account = createMockAccount("1.0000000", 0);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("0");
    });

    it("handles high precision balance calculations", () => {
      // 10.5000000 XLM raw, 2 XLM reserve = 8.5000000 XLM spendable
      const account = createMockAccount("10.5000000", 0);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("8.5000000");
    });

    it("correctly handles edge case: account with exactly base reserve", () => {
      // 2 XLM raw, 2 XLM reserve = 0 XLM spendable (cannot send anything)
      const account = createMockAccount("2.0000000", 0);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("0");
    });

    it("correctly handles edge case: account with barely more than base reserve", () => {
      // 2.0000001 XLM raw, 2 XLM reserve = 0.0000001 XLM spendable (1 stroop)
      const account = createMockAccount("2.0000001", 0);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("0.0000001");
    });
  });

  describe("getBalanceInfo", () => {
    it("returns comprehensive balance information", () => {
      const account = createMockAccount("10.0000000", 1);
      const info = getBalanceInfo(account);

      expect(info.raw).toBe("10.0000000");
      expect(info.spendable).toBe("7.5000000");
      expect(info.reserve).toBe("2.5000000");
      expect(info.subentryCount).toBe(1);
    });

    it("includes zero subentry count", () => {
      const account = createMockAccount("5.0000000", 0);
      const info = getBalanceInfo(account);

      expect(info.subentryCount).toBe(0);
      expect(info.reserve).toBe("2.0000000");
    });
  });

  describe("Real-world scenarios", () => {
    it("new account funded with minimum reserve", () => {
      // New custodial wallet just funded with 2 XLM
      const account = createMockAccount("2.0000000", 0);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("0"); // Nothing spendable, all is reserved
    });

    it("account after receiving first tip", () => {
      // User receives 5 XLM tip to their 2 XLM reserve
      const account = createMockAccount("7.0000000", 0);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("5.0000000"); // 7 - 2 = 5 spendable
    });

    it("account with one trustline (multi-asset)", () => {
      // User adds trustline for USDC, now has 1 additional entry
      // Total reserve: 2 + 0.5 = 2.5 XLM
      const account = createMockAccount("10.0000000", 1);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("7.5000000");
    });

    it("creator account with multiple trustlines and offers", () => {
      // Creator with 5 trustlines + 2 open offers = 7 subentries
      // Total reserve: 2 + (7 * 0.5) = 5.5 XLM
      const account = createMockAccount("100.0000000", 7);
      const spendable = calculateSpendableBalance(account);
      expect(spendable).toBe("94.5000000");
    });

    it("insufficient balance prevents loss due to reserve", () => {
      // User has 10 XLM, wants to send 9.5 XLM
      // But only 8 XLM is spendable (10 - 2 reserve)
      // Balance check should reject the 9.5 XLM send
      const account = createMockAccount("10.0000000", 0);
      const spendable = parseFloat(calculateSpendableBalance(account));
      const wantToSend = 9.5;
      expect(spendable < wantToSend).toBe(true); // Should reject
    });
  });
});
