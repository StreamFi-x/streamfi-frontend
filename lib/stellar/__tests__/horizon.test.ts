/**
 * Unit tests for Stellar Horizon client utilities (lib/stellar/horizon.ts).
 */

import {
  fetchPaymentsReceived,
  getAccountTipStats,
  isValidStellarPublicKey,
  isHorizonNotFound,
  getAccountBalances,
} from "../horizon";
import { Keypair } from "@stellar/stellar-sdk";

const mockPaymentsCall = jest.fn();
const mockAccountsCall = jest.fn();

const mockBuilder: any = {
  forAccount: jest.fn().mockImplementation(() => mockBuilder),
  limit: jest.fn().mockImplementation(() => mockBuilder),
  cursor: jest.fn().mockImplementation(() => mockBuilder),
  order: jest.fn().mockImplementation(() => mockBuilder),
  call: mockPaymentsCall,
};

const mockServerInstance = {
  payments: jest.fn(() => mockBuilder),
  accounts: jest.fn(() => ({
    accountId: jest.fn(() => ({
      call: mockAccountsCall,
    })),
  })),
};

jest.mock("../horizon-client", () => ({
  callHorizon: jest.fn(async (fn: (server: any) => Promise<any>) => {
    return fn(mockServerInstance);
  }),
}));

describe("Stellar Horizon Client", () => {
  let validPublicKey: string;
  let senderPublicKey: string;

  beforeAll(() => {
    validPublicKey = Keypair.random().publicKey();
    senderPublicKey = Keypair.random().publicKey();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isValidStellarPublicKey", () => {
    it("returns true for valid ed25519 public keys", () => {
      expect(isValidStellarPublicKey(validPublicKey)).toBe(true);
    });

    it("returns false for invalid, malformed, or empty strings", () => {
      expect(isValidStellarPublicKey("")).toBe(false);
      expect(isValidStellarPublicKey("G12345")).toBe(false);
      expect(isValidStellarPublicKey("0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
      expect(isValidStellarPublicKey(null as any)).toBe(false);
      expect(isValidStellarPublicKey(undefined as any)).toBe(false);
    });
  });

  describe("fetchPaymentsReceived", () => {
    it("throws an error when an invalid public key is provided", async () => {
      await expect(
        fetchPaymentsReceived({ publicKey: "INVALID_KEY" })
      ).rejects.toThrow("Invalid Stellar public key: INVALID_KEY");
    });

    it("fetches and filters incoming XLM and USDC tips correctly", async () => {
      const records = [
        {
          id: "pay_1",
          type: "payment",
          to: validPublicKey,
          from: senderPublicKey,
          amount: "15.5000000",
          asset_type: "native",
          transaction_hash: "tx_hash_1",
          created_at: "2026-11-24T12:00:00Z",
          ledger: 50001,
          paging_token: "cursor_1",
        },
        {
          id: "pay_2",
          type: "payment",
          to: validPublicKey,
          from: senderPublicKey,
          amount: "5.0000000",
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: "GUSDCISSUERADDRESS1234567890ABCDEF",
          transaction_hash: "tx_hash_2",
          created_at: "2026-11-24T12:05:00Z",
          ledger: 50002,
          paging_token: "cursor_2",
        },
        {
          // Outgoing payment - should be excluded
          id: "pay_3",
          type: "payment",
          to: senderPublicKey,
          from: validPublicKey,
          amount: "2.0000000",
          asset_type: "native",
          transaction_hash: "tx_hash_3",
          created_at: "2026-11-24T12:10:00Z",
          ledger: 50003,
          paging_token: "cursor_3",
        },
      ];

      mockPaymentsCall.mockResolvedValueOnce({ records });

      const result = await fetchPaymentsReceived({
        publicKey: validPublicKey,
      });

      expect(result.tips).toHaveLength(2);
      expect(result.tips[0]).toEqual({
        id: "pay_1",
        sender: senderPublicKey,
        amount: "15.5000000",
        asset: "XLM",
        assetIssuer: undefined,
        txHash: "tx_hash_1",
        timestamp: "2026-11-24T12:00:00Z",
        ledger: 50001,
      });
      expect(result.tips[1]).toEqual({
        id: "pay_2",
        sender: senderPublicKey,
        amount: "5.0000000",
        asset: "USDC",
        assetIssuer: "GUSDCISSUERADDRESS1234567890ABCDEF",
        txHash: "tx_hash_2",
        timestamp: "2026-11-24T12:05:00Z",
        ledger: 50002,
      });
      expect(result.nextCursor).toBe("cursor_3");
    });

    it("respects assetType filter for native XLM only", async () => {
      const records = [
        {
          id: "pay_1",
          type: "payment",
          to: validPublicKey,
          from: senderPublicKey,
          amount: "10.0000000",
          asset_type: "native",
          transaction_hash: "tx_1",
          created_at: "2026-11-24T12:00:00Z",
          ledger: 50001,
          paging_token: "c_1",
        },
        {
          id: "pay_2",
          type: "payment",
          to: validPublicKey,
          from: senderPublicKey,
          amount: "25.0000000",
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          transaction_hash: "tx_2",
          created_at: "2026-11-24T12:05:00Z",
          ledger: 50002,
          paging_token: "c_2",
        },
      ];

      mockPaymentsCall.mockResolvedValueOnce({ records });

      const result = await fetchPaymentsReceived({
        publicKey: validPublicKey,
        assetType: "native",
      });

      expect(result.tips).toHaveLength(1);
      expect(result.tips[0].asset).toBe("XLM");
    });
  });

  describe("getAccountTipStats", () => {
    it("throws error for invalid public key", async () => {
      await expect(getAccountTipStats("BAD_KEY")).rejects.toThrow("Invalid Stellar public key: BAD_KEY");
    });

    it("aggregates XLM and USDC totals and updates last tip timestamp", async () => {
      const records = [
        {
          type: "payment",
          to: validPublicKey,
          amount: "20.5000000",
          asset_type: "native",
          created_at: "2026-11-24T10:00:00Z",
        },
        {
          type: "payment",
          to: validPublicKey,
          amount: "10.0000000",
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          created_at: "2026-11-24T11:30:00Z",
        },
      ];

      mockPaymentsCall.mockResolvedValueOnce({ records });

      const stats = await getAccountTipStats(validPublicKey);

      expect(stats.totalTipsCount).toBe(2);
      expect(stats.totalXlmReceived).toBe("20.5000000");
      expect(stats.totalUsdcReceived).toBe("10.00");
      expect(stats.breakdownByAsset.XLM).toEqual({
        totalAmount: "20.5000000",
        count: 1,
      });
      expect(stats.breakdownByAsset.USDC).toEqual({
        totalAmount: "10.00",
        count: 1,
      });
      expect(stats.lastTipAt).toBe("2026-11-24T11:30:00.000Z");
    });
  });

  describe("isHorizonNotFound and getAccountBalances", () => {
    it("identifies 404 responses or NotFoundError correctly", () => {
      expect(isHorizonNotFound({ response: { status: 404 } })).toBe(true);
      expect(isHorizonNotFound({ name: "NotFoundError" })).toBe(true);
      expect(isHorizonNotFound({ response: { status: 500 } })).toBe(false);
      expect(isHorizonNotFound(null)).toBe(false);
    });

    it("returns null when account does not exist on network", async () => {
      mockAccountsCall.mockRejectedValueOnce({ name: "NotFoundError" });
      const balances = await getAccountBalances(validPublicKey);
      expect(balances).toBeNull();
    });

    it("returns parsed balances when account exists", async () => {
      mockAccountsCall.mockResolvedValueOnce({
        balances: [
          { asset_type: "native", balance: "100.0000000" },
          { asset_type: "credit_alphanum4", balance: "50.00" },
        ],
      });
      const balances = await getAccountBalances(validPublicKey);
      expect(balances).toEqual([
        { assetType: "native", balance: "100.0000000" },
        { assetType: "credit_alphanum4", balance: "50.00" },
      ]);
    });
  });
});
