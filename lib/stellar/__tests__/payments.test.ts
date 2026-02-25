/**
 * Unit tests for Stellar payment utilities (lib/stellar/payments.ts).
 * Run with: npx jest lib/stellar/__tests__/payments.test.ts
 */

import {
  buildTipTransaction,
  submitTransaction,
  hasInsufficientBalance,
  getXLMPrice,
  calculateFeeEstimate,
  isValidStellarPublicKey,
  formatXLMAmount,
  getCurrentNetwork,
} from "../payments";
import { Keypair } from "@stellar/stellar-sdk";

const mockServerInstance = {
  loadAccount: jest.fn(),
  submitTransaction: jest.fn(),
};

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Horizon: {
      Server: jest.fn(() => mockServerInstance),
    },
  };
});

describe("Stellar Payments", () => {
  let validSenderKey: string;
  let validRecipientKey: string;
  beforeAll(() => {
    const senderKp = Keypair.random();
    const recipientKp = Keypair.random();
    validSenderKey = senderKp.publicKey();
    validRecipientKey = recipientKp.publicKey();
  });

  let consoleErrorSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  function buildParams(overrides: Partial<{ amount: string; network: "testnet" | "mainnet" }> = {}) {
    return {
      sourcePublicKey: validSenderKey,
      destinationPublicKey: validRecipientKey,
      amount: "10",
      network: "testnet" as const,
      ...overrides,
    };
  }

  describe("buildTipTransaction", () => {
    beforeEach(() => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
    });

    it("should build transaction with valid inputs", async () => {
      const transaction = await buildTipTransaction(buildParams());

      expect(transaction).toBeDefined();
      expect(transaction.operations).toHaveLength(1);
      expect(transaction.memo.value).toBe("StreamFi Tip");
    });

    it("should handle account not found error", async () => {
      mockServerInstance.loadAccount.mockRejectedValue(
        new Error("Account not found")
      );

      await expect(buildTipTransaction(buildParams())).rejects.toThrow();
    });

    it("should build transaction with custom amount", async () => {
      const transaction = await buildTipTransaction(buildParams({ amount: "5.5" }));

      expect(transaction).toBeDefined();
      expect(transaction.operations).toHaveLength(1);
    });
  });

  describe("submitTransaction", () => {
    it("should submit transaction successfully", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
      const transaction = await buildTipTransaction(buildParams({ amount: "1" }));
      mockServerInstance.submitTransaction.mockResolvedValue({
        hash: "ABC123",
        ledger: 12345,
      });

      const result = await submitTransaction(transaction, "testnet");

      expect(result.success).toBe(true);
      expect(result.hash).toBe("ABC123");
      expect(result.ledger).toBe(12345);
    });

    it("should handle transaction submission failure", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
      const transaction = await buildTipTransaction(buildParams({ amount: "1" }));
      mockServerInstance.submitTransaction.mockRejectedValue(
        new Error("Transaction failed")
      );

      const result = await submitTransaction(transaction, "testnet");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("hasInsufficientBalance", () => {
    const mockPublicKey = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

    it("should return false when balance is sufficient", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        balances: [{ asset_type: "native", balance: "100.0000000" }],
      });

      const result = await hasInsufficientBalance(mockPublicKey, "10");

      expect(result).toBe(false);
    });

    it("should return true when balance is insufficient", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        balances: [{ asset_type: "native", balance: "1.0000000" }],
      });

      const result = await hasInsufficientBalance(mockPublicKey, "100");

      expect(result).toBe(true);
    });

    it("should consider transaction fees in calculation", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        balances: [{ asset_type: "native", balance: "10.0000000" }],
      });

      // 10 XLM balance - 10 XLM tip leaves only fee margin; required = 10 + fee > 10
      const result = await hasInsufficientBalance(mockPublicKey, "10");

      expect(result).toBe(true);
    });

    it("should return true on account error", async () => {
      mockServerInstance.loadAccount.mockRejectedValue(
        new Error("Account not found")
      );

      const result = await hasInsufficientBalance(mockPublicKey, "10");

      expect(result).toBe(true);
    });

    it("should handle missing native balance", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        balances: [{ asset_type: "credit_alphanum4", balance: "100.0000000" }],
      });

      const result = await hasInsufficientBalance(mockPublicKey, "10");

      expect(result).toBe(true);
    });
  });

  describe("getXLMPrice", () => {
    const COINGECKO_URL =
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";

    beforeEach(() => {
      global.fetch = jest.fn() as any;
    });

    it("should fetch XLM price successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ stellar: { usd: 0.12 } }),
      });

      const price = await getXLMPrice();

      expect(price).toBe(0.12);
      expect(global.fetch).toHaveBeenCalledWith(COINGECKO_URL);
    });

    it("should return 0.12 fallback on API failure", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("API error"));

      const price = await getXLMPrice();

      expect(price).toBe(0.12);
    });

    it("should return 0.12 fallback on invalid response format", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ invalid: "data" }),
      });

      const price = await getXLMPrice();

      expect(price).toBe(0.12);
    });

    it("should return numeric price from API", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ stellar: { usd: 1.5678 } }),
      });

      const price = await getXLMPrice();

      expect(price).toBe(1.5678);
    });
  });

  describe("calculateFeeEstimate", () => {
    it("should return correct fee estimate", () => {
      const fee = calculateFeeEstimate();

      // BASE_FEE is typically 100 stroops = 0.00001 XLM
      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThan(1);
    });

    it("should return consistent values", () => {
      const fee1 = calculateFeeEstimate();
      const fee2 = calculateFeeEstimate();

      expect(fee1).toBe(fee2);
    });

    it("should return fee in XLM (not stroops)", () => {
      const fee = calculateFeeEstimate();

      // Fee should be a small decimal (XLM), not a large integer (stroops)
      expect(fee).toBeLessThan(0.1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small amounts correctly", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });

      const transaction = await buildTipTransaction(
        buildParams({ amount: "0.0000001" })
      );

      expect(transaction).toBeDefined();
      expect(transaction.operations).toHaveLength(1);
    });

    it("should handle very large amounts correctly", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });

      const transaction = await buildTipTransaction(
        buildParams({ amount: "9999" })
      );

      expect(transaction).toBeDefined();
      expect(transaction.operations).toHaveLength(1);
    });

    it("should handle concurrent price fetches", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ stellar: { usd: 0.12 } }),
      }) as any;

      const promises = [getXLMPrice(), getXLMPrice(), getXLMPrice()];
      const results = await Promise.all(promises);

      expect(results).toEqual([0.12, 0.12, 0.12]);
    });
  });
});
