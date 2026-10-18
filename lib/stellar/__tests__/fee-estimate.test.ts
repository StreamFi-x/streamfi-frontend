/**
 * #752: the fee estimate comes from Horizon's feeStats (cached, with a
 * fallback) and the same value feeds the balance check and the transaction.
 */
import { Keypair } from "@stellar/stellar-sdk";
import {
  buildTipTransaction,
  calculateFeeEstimate,
  getRecommendedFeeStroops,
  hasInsufficientBalance,
  resetFeeCacheForTests,
} from "../payments";

const mockServer = {
  loadAccount: jest.fn(),
  submitTransaction: jest.fn(),
  feeStats: jest.fn(),
};

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return { ...actual, Horizon: { Server: jest.fn(() => mockServer) } };
});
jest.mock("@creit.tech/stellar-wallets-kit", () => ({
  StellarWalletsKit: jest.fn(() => ({})),
  WalletNetwork: { PUBLIC: "PUBLIC", TESTNET: "TESTNET" },
  FREIGHTER_ID: "freighter",
  FreighterModule: jest.fn(),
  xBullModule: jest.fn(),
}));

function stats(p90: string, lastBase = "100") {
  return { last_ledger_base_fee: lastBase, max_fee: { p90 } };
}

const sender = Keypair.random().publicKey();
const recipient = Keypair.random().publicKey();

function account(balance: string) {
  return {
    accountId: () => sender,
    sequenceNumber: () => "1",
    incrementSequenceNumber: jest.fn(),
    balances: [{ asset_type: "native", balance }],
  };
}

beforeEach(() => {
  jest.useRealTimers();
  resetFeeCacheForTests();
  mockServer.feeStats.mockReset();
  mockServer.loadAccount.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("getRecommendedFeeStroops", () => {
  it("uses the network's p90 under congestion", async () => {
    mockServer.feeStats.mockResolvedValue(stats("5000"));
    expect(await getRecommendedFeeStroops("testnet")).toBe(5000);
  });

  it("never goes below the base fee", async () => {
    mockServer.feeStats.mockResolvedValue(stats("50", "100"));
    expect(await getRecommendedFeeStroops("testnet")).toBe(100);
  });

  it("caps an absurd response", async () => {
    mockServer.feeStats.mockResolvedValue(stats("999999999"));
    expect(await getRecommendedFeeStroops("testnet")).toBe(100_000);
  });

  it("caches, so repeated calls do not hit Horizon", async () => {
    mockServer.feeStats.mockResolvedValue(stats("300"));
    await Promise.all([
      getRecommendedFeeStroops("testnet"),
      getRecommendedFeeStroops("testnet"),
    ]);
    await getRecommendedFeeStroops("testnet");
    expect(mockServer.feeStats).toHaveBeenCalledTimes(1);
  });

  it("caches per network", async () => {
    mockServer.feeStats.mockResolvedValueOnce(stats("300"));
    mockServer.feeStats.mockResolvedValueOnce(stats("900"));
    expect(await getRecommendedFeeStroops("testnet")).toBe(300);
    expect(await getRecommendedFeeStroops("mainnet")).toBe(900);
  });

  it("falls back to the base fee when feeStats fails", async () => {
    mockServer.feeStats.mockRejectedValue(new Error("down"));
    expect(await getRecommendedFeeStroops("testnet")).toBe(100);
  });

  it("falls back when feeStats hangs", async () => {
    jest.useFakeTimers();
    mockServer.feeStats.mockReturnValue(new Promise(() => undefined));
    const pending = getRecommendedFeeStroops("testnet");
    await jest.advanceTimersByTimeAsync(3_001);
    expect(await pending).toBe(100);
  });

  it("keeps the last known fee when a refresh fails", async () => {
    jest.useFakeTimers();
    mockServer.feeStats.mockResolvedValueOnce(stats("700"));
    expect(await getRecommendedFeeStroops("testnet")).toBe(700);
    await jest.advanceTimersByTimeAsync(31_000);
    mockServer.feeStats.mockRejectedValueOnce(new Error("down"));
    expect(await getRecommendedFeeStroops("testnet")).toBe(700);
  });
});

describe("balance check and transaction share one fee", () => {
  it("rejects a balance that cannot cover amount + congested fee", async () => {
    mockServer.feeStats.mockResolvedValue(stats("10000000")); // capped: 0.01 XLM
    mockServer.loadAccount.mockResolvedValue(account("10.0050000"));
    // 10 + 0.01 fee > 10.005 balance; the old constant fee (0.00001) passed.
    expect(await hasInsufficientBalance(sender, "10")).toBe(true);
  });

  it("accepts the same balance when the fee is the minimum", async () => {
    mockServer.feeStats.mockResolvedValue(stats("100"));
    mockServer.loadAccount.mockResolvedValue(account("10.0050000"));
    expect(await hasInsufficientBalance(sender, "10")).toBe(false);
  });

  it("builds the transaction with the fee the check used", async () => {
    mockServer.feeStats.mockResolvedValue(stats("2500"));
    mockServer.loadAccount.mockResolvedValue(account("100"));
    const tx = await buildTipTransaction({
      sourcePublicKey: sender,
      destinationPublicKey: recipient,
      amount: "1",
      network: "testnet",
    });
    expect(tx.fee).toBe("2500");
    expect(calculateFeeEstimate(Number(tx.fee))).toBeCloseTo(0.00025, 8);
  });

  it("honours an explicit feeStroops over the live value", async () => {
    mockServer.loadAccount.mockResolvedValue(account("100"));
    const tx = await buildTipTransaction({
      sourcePublicKey: sender,
      destinationPublicKey: recipient,
      amount: "1",
      network: "testnet",
      feeStroops: 4242,
    });
    expect(tx.fee).toBe("4242");
    expect(mockServer.feeStats).not.toHaveBeenCalled();
  });

  it("still builds at the base fee when feeStats is unavailable", async () => {
    mockServer.feeStats.mockRejectedValue(new Error("down"));
    mockServer.loadAccount.mockResolvedValue(account("100"));
    const tx = await buildTipTransaction({
      sourcePublicKey: sender,
      destinationPublicKey: recipient,
      amount: "1",
      network: "testnet",
    });
    expect(tx.fee).toBe("100");
  });
});
