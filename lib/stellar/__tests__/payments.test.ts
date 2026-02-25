/**
 * Jest tests for Stellar payment utilities.
 * Run with: npx jest lib/stellar/__tests__/payments.test.ts
 */

import {
  buildTipTransaction,
  submitTransaction,
  isValidStellarPublicKey,
  formatXLMAmount,
  getCurrentNetwork,
  hasInsufficientBalance,
  getXLMPrice,
  calculateFeeEstimate,
} from "../payments";
import { Keypair } from "@stellar/stellar-sdk";

const TEST_NETWORK = "testnet" as const;

function buildTipParams(
  source: string,
  destination: string,
  amount: string,
  network: "testnet" | "mainnet" = TEST_NETWORK
) {
  return { sourcePublicKey: source, destinationPublicKey: destination, amount, network };
}

// Shared mock instances so the module under test (which creates one server at load time) uses the same instance we configure.
// Created inside jest.mock factory and attached to global so they exist when the module loads.
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  const mockServerInstance = {
    loadAccount: jest.fn(),
    ledgers: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    call: jest.fn(),
    submitTransaction: jest.fn(),
  };
  (global as any).__mockStellarServer = mockServerInstance;
  return {
    ...actual,
    Horizon: {
      Server: jest.fn(() => mockServerInstance),
    },
  };
});

// Mock Stellar Wallets Kit - constructor returns shared instance so getStellarWalletsKit() returns it
jest.mock("@creit.tech/stellar-wallets-kit", () => {
  const mockKitInstance = {
    signTransaction: jest.fn(),
    getPublicKey: jest.fn(),
  };
  (global as any).__mockStellarKit = mockKitInstance;
  return {
    StellarWalletsKit: jest.fn(() => mockKitInstance),
    WalletNetwork: { PUBLIC: "PUBLIC", TESTNET: "TESTNET" },
    FREIGHTER_ID: "freighter",
    FreighterModule: jest.fn(),
    xBullModule: jest.fn(),
  };
});

describe("Stellar Payments", () => {
  const mockServerInstance = (global as any).__mockStellarServer;
  const mockKitInstance = (global as any).__mockStellarKit;

  // Valid Stellar keys (SDK validates format) for buildTipTransaction and submitTransaction
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
    // Suppress expected console.error from payments.ts catch blocks (tests trigger error paths on purpose)
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  describe("buildTipTransaction", () => {
    beforeEach(() => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
    });

    it("should build transaction with valid inputs", async () => {
      const transaction = await buildTipTransaction(
        buildTipParams(validSenderKey, validRecipientKey, "10")
      );

      expect(transaction).toBeDefined();
      expect(transaction.operations).toBeDefined();
      expect(transaction.operations.length).toBeGreaterThan(0);
    });

    it("should reject invalid amount (negative)", async () => {
      await expect(
        buildTipTransaction(buildTipParams(validSenderKey, validRecipientKey, "-5"))
      ).rejects.toThrow();
    });

    it("should reject invalid amount (zero)", async () => {
      await expect(
        buildTipTransaction(buildTipParams(validSenderKey, validRecipientKey, "0"))
      ).rejects.toThrow();
    });

    it("should reject invalid amount (NaN)", async () => {
      await expect(
        buildTipTransaction(buildTipParams(validSenderKey, validRecipientKey, "abc"))
      ).rejects.toThrow();
    });

    it("should handle account not found error", async () => {
      mockServerInstance.loadAccount.mockRejectedValue(
        new Error("Account not found")
      );

      await expect(
        buildTipTransaction(buildTipParams(validSenderKey, validRecipientKey, "10"))
      ).rejects.toThrow();
    });

    it("should build transaction with memo", async () => {
      const transaction = await buildTipTransaction(
        buildTipParams(validSenderKey, validRecipientKey, "10")
      );

      expect(transaction).toBeDefined();
      expect(transaction.memo).toBeDefined();
    });

    it("should handle transaction with valid amount only", async () => {
      const transaction = await buildTipTransaction(
        buildTipParams(validSenderKey, validRecipientKey, "10")
      );

      expect(transaction).toBeDefined();
      expect(transaction.operations.length).toBeGreaterThan(0);
    });
  });

  describe("submitTransaction", () => {
    it("should submit transaction successfully", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
      const transaction = await buildTipTransaction(
        buildTipParams(validSenderKey, validRecipientKey, "1")
      );
      mockServerInstance.submitTransaction.mockResolvedValue({
        hash: "ABC123",
        ledger: 12345,
      });

      const result = await submitTransaction(transaction, TEST_NETWORK);

      expect(result.success).toBe(true);
      expect(result.hash).toBe("ABC123");
      expect(result.ledger).toBe(12345);
    });

    it("should return failure when submission fails", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
      const transaction = await buildTipTransaction(
        buildTipParams(validSenderKey, validRecipientKey, "1")
      );
      mockServerInstance.submitTransaction.mockRejectedValue(
        new Error("Transaction failed")
      );

      const result = await submitTransaction(transaction, TEST_NETWORK);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return failure with message on Horizon error", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
      const transaction = await buildTipTransaction(
        buildTipParams(validSenderKey, validRecipientKey, "1")
      );
      mockServerInstance.submitTransaction.mockRejectedValue({
        response: {
          data: {
            extras: {
              result_codes: {
                transaction: "tx_insufficient_balance",
                operations: ["op_underfunded"],
              },
            },
          },
        },
      });

      const result = await submitTransaction(transaction, TEST_NETWORK);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient");
    });
  });

  describe("hasInsufficientBalance", () => {
    const mockPublicKey = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

    it("should return false when balance is sufficient", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        balances: [
          { asset_type: "native", balance: "100.0000000" },
        ],
      });
      mockServerInstance.ledgers.mockReturnThis();
      mockServerInstance.order.mockReturnThis();
      mockServerInstance.limit.mockReturnThis();
      mockServerInstance.call.mockResolvedValue({
        records: [{ base_reserve_in_stroops: 5000000 }],
      });

      const result = await hasInsufficientBalance(mockPublicKey, "10");

      expect(result).toBe(false);
    });

    it("should return true when balance is insufficient", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        balances: [
          { asset_type: "native", balance: "1.0000000" },
        ],
      });
      mockServerInstance.ledgers.mockReturnThis();
      mockServerInstance.order.mockReturnThis();
      mockServerInstance.limit.mockReturnThis();
      mockServerInstance.call.mockResolvedValue({
        records: [{ base_reserve_in_stroops: 5000000 }],
      });

      const result = await hasInsufficientBalance(mockPublicKey, "100");

      expect(result).toBe(true);
    });

    it("should consider transaction fees in calculation", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        balances: [
          { asset_type: "native", balance: "10.0000000" },
        ],
      });
      mockServerInstance.ledgers.mockReturnThis();
      mockServerInstance.order.mockReturnThis();
      mockServerInstance.limit.mockReturnThis();
      mockServerInstance.call.mockResolvedValue({
        records: [{ base_reserve_in_stroops: 5000000 }],
      });

      // Balance 10 XLM, amount 10 XLM: required = 10 + fee > 10, so insufficient
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
        balances: [
          { asset_type: "credit_alphanum4", balance: "100.0000000" },
        ],
      });
      mockServerInstance.ledgers.mockReturnThis();
      mockServerInstance.order.mockReturnThis();
      mockServerInstance.limit.mockReturnThis();
      mockServerInstance.call.mockResolvedValue({
        records: [{ base_reserve_in_stroops: 5000000 }],
      });

      const result = await hasInsufficientBalance(mockPublicKey, "10");

      expect(result).toBe(true);
    });
  });

  describe("getXLMPrice", () => {
    const COINGECKO_URL =
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";

    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        json: async () => ({ stellar: { usd: 0.12 } }),
      } as Response);
    });

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it("should fetch XLM price successfully", async () => {
      fetchSpy.mockResolvedValueOnce({
        json: async () => ({ stellar: { usd: 0.12 } }),
      } as Response);

      const price = await getXLMPrice();

      expect(price).toBe(0.12);
      expect(global.fetch).toHaveBeenCalledWith(COINGECKO_URL);
    });

    it("should return fallback on API failure", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("API error"));

      const price = await getXLMPrice();

      expect(price).toBe(0.12);
    });

    it("should return fallback on invalid response format", async () => {
      fetchSpy.mockResolvedValueOnce({
        json: async () => ({ invalid: "data" }),
      } as Response);

      const price = await getXLMPrice();

      expect(price).toBe(0.12);
    });

    it("should parse numeric price correctly", async () => {
      fetchSpy.mockResolvedValueOnce({
        json: async () => ({ stellar: { usd: 1.5678 } }),
      } as Response);

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
        buildTipParams(validSenderKey, validRecipientKey, "0.0000001")
      );

      expect(transaction).toBeDefined();
    });

    it("should handle very large amounts correctly", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });

      const transaction = await buildTipTransaction(
        buildTipParams(validSenderKey, validRecipientKey, "9999")
      );

      expect(transaction).toBeDefined();
    });

    it("should handle concurrent price fetches", async () => {
      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        json: async () => ({ stellar: { usd: 0.12 } }),
      } as Response);

      const promises = [getXLMPrice(), getXLMPrice(), getXLMPrice()];
      const results = await Promise.all(promises);

      expect(results).toEqual([0.12, 0.12, 0.12]);
      fetchSpy.mockRestore();
    });
  });
});
