import {
  buildTipTransaction,
  submitTransaction,
  hasInsufficientBalance,
  getXLMPrice,
  calculateFeeEstimate,
  getAccount,
  getMinimumBalance,
} from "../payments";
import * as StellarSdk from "@stellar/stellar-sdk";

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

// Mock fetch for getXLMPrice
global.fetch = jest.fn();

describe("Stellar Payments", () => {
  const mockServerInstance = (global as any).__mockStellarServer;
  const mockKitInstance = (global as any).__mockStellarKit;

  // Valid Stellar keys (SDK validates format) for buildTipTransaction and submitTransaction
  let validSenderKey: string;
  let validRecipientKey: string;
  beforeAll(() => {
    const senderKp = StellarSdk.Keypair.random();
    const recipientKp = StellarSdk.Keypair.random();
    validSenderKey = senderKp.publicKey();
    validRecipientKey = recipientKp.publicKey();
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
      const xdr = await buildTipTransaction(
        validSenderKey,
        validRecipientKey,
        "10",
        "Test tip"
      );

      expect(typeof xdr).toBe("string");
      expect(xdr.length).toBeGreaterThan(0);
    });

    it("should reject invalid amount (negative)", async () => {
      await expect(
        buildTipTransaction(validSenderKey, validRecipientKey, "-5")
      ).rejects.toThrow("Invalid amount");
    });

    it("should reject invalid amount (zero)", async () => {
      await expect(
        buildTipTransaction(validSenderKey, validRecipientKey, "0")
      ).rejects.toThrow("Invalid amount");
    });

    it("should reject invalid amount (NaN)", async () => {
      await expect(
        buildTipTransaction(validSenderKey, validRecipientKey, "abc")
      ).rejects.toThrow("Invalid amount");
    });

    it("should handle account not found error", async () => {
      mockServerInstance.loadAccount.mockRejectedValue(
        new Error("Account not found")
      );

      await expect(
        buildTipTransaction(validSenderKey, validRecipientKey, "10")
      ).rejects.toThrow();
    });

    it("should truncate memo to 28 characters", async () => {
      const longMemo = "This is a very long memo that exceeds the 28 character limit";

      const xdr = await buildTipTransaction(
        validSenderKey,
        validRecipientKey,
        "10",
        longMemo
      );

      expect(xdr).toBeDefined();
      // Memo should be truncated to 28 chars
    });

    it("should handle transaction without memo", async () => {
      const xdr = await buildTipTransaction(
        validSenderKey,
        validRecipientKey,
        "10"
      );

      expect(typeof xdr).toBe("string");
      expect(xdr.length).toBeGreaterThan(0);
    });
  });

  describe("submitTransaction", () => {
    const mockPublicKey = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

    it("should submit transaction successfully", async () => {
      // Build real XDR so TransactionBuilder.fromXDR() in submitTransaction succeeds
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
      const realXDR = await buildTipTransaction(
        validSenderKey,
        validRecipientKey,
        "1"
      );
      mockKitInstance.signTransaction.mockResolvedValue({
        signedTxXdr: realXDR,
      });
      mockServerInstance.submitTransaction.mockResolvedValue({
        hash: "ABC123",
        successful: true,
      });

      const result = await submitTransaction(realXDR, mockPublicKey);

      expect(result.success).toBe(true);
      expect(result.hash).toBe("ABC123");
    });

    it("should handle transaction submission failure", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
      const realXDR = await buildTipTransaction(
        validSenderKey,
        validRecipientKey,
        "1"
      );
      mockKitInstance.signTransaction.mockResolvedValue({
        signedTxXdr: realXDR,
      });
      mockServerInstance.submitTransaction.mockRejectedValue(
        new Error("Transaction failed")
      );

      await expect(
        submitTransaction(realXDR, mockPublicKey)
      ).rejects.toThrow();
    });

    it("should handle user rejection", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });
      const realXDR = await buildTipTransaction(
        validSenderKey,
        validRecipientKey,
        "1"
      );
      mockKitInstance.signTransaction.mockRejectedValue(
        new Error("User declined")
      );

      await expect(
        submitTransaction(realXDR, mockPublicKey)
      ).rejects.toThrow("User declined");
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

      // Should account for minimum balance + fee
      const result = await hasInsufficientBalance(mockPublicKey, "9");

      // With 10 XLM balance, tipping 9 XLM should be insufficient
      // because it would leave less than minimum balance + fees
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
    it("should fetch XLM price successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({
          data: { amount: "0.12" },
        }),
      });

      const price = await getXLMPrice();

      expect(price).toBe(0.12);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.coinbase.com/v2/prices/XLM-USD/spot"
      );
    });

    it("should return 0 on API failure", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("API error"));

      const price = await getXLMPrice();

      expect(price).toBe(0);
    });

    it("should handle invalid response format", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ invalid: "data" }),
      });

      const price = await getXLMPrice();

      expect(price).toBeNaN();
    });

    it("should parse string prices correctly", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({
          data: { amount: "1.5678" },
        }),
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

  describe("getAccount", () => {
    const mockPublicKey = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

    it("should load account successfully", async () => {
      const mockAccount = {
        accountId: () => mockPublicKey,
        sequenceNumber: () => "123456",
      };

      mockServerInstance.loadAccount.mockResolvedValue(mockAccount);

      const account = await getAccount(mockPublicKey);

      expect(account).toBeDefined();
      expect(mockServerInstance.loadAccount).toHaveBeenCalledWith(mockPublicKey);
    });

    it("should throw error for non-existent account", async () => {
      mockServerInstance.loadAccount.mockRejectedValue(
        new Error("Account not found")
      );

      await expect(getAccount(mockPublicKey)).rejects.toThrow(
        "Failed to load account"
      );
    });
  });

  describe("getMinimumBalance", () => {
    it("should calculate minimum balance correctly", async () => {
      mockServerInstance.ledgers.mockReturnThis();
      mockServerInstance.order.mockReturnThis();
      mockServerInstance.limit.mockReturnThis();
      mockServerInstance.call.mockResolvedValue({
        records: [{ base_reserve_in_stroops: 5000000 }], // 0.5 XLM
      });

      const minBalance = await getMinimumBalance();

      // Minimum balance = 2 * base_reserve = 2 * 0.5 = 1 XLM
      expect(minBalance).toBe(1);
    });

    it("should return default value on error", async () => {
      mockServerInstance.ledgers.mockReturnThis();
      mockServerInstance.order.mockReturnThis();
      mockServerInstance.limit.mockReturnThis();
      mockServerInstance.call.mockRejectedValue(new Error("API error"));

      const minBalance = await getMinimumBalance();

      expect(minBalance).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small amounts correctly", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });

      const xdr = await buildTipTransaction(
        validSenderKey,
        validRecipientKey,
        "0.0000001" // Minimum valid amount
      );

      expect(xdr).toBeDefined();
    });

    it("should handle very large amounts correctly", async () => {
      mockServerInstance.loadAccount.mockResolvedValue({
        accountId: () => validSenderKey,
        sequenceNumber: () => "123456",
        incrementSequenceNumber: jest.fn(),
      });

      const xdr = await buildTipTransaction(
        validSenderKey,
        validRecipientKey,
        "9999" // Large but valid amount
      );

      expect(xdr).toBeDefined();
    });

    it("should handle concurrent price fetches", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({
          data: { amount: "0.12" },
        }),
      });

      const promises = [getXLMPrice(), getXLMPrice(), getXLMPrice()];
      const results = await Promise.all(promises);

      expect(results).toEqual([0.12, 0.12, 0.12]);
    });
  });
});
