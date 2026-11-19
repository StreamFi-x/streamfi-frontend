import {
  pollTransactionConfirmation,
  type TransactionConfirmationProgress,
} from "../tx-confirmation";

const mockTxCall = jest.fn();
const mockTransaction = jest.fn(() => ({ call: mockTxCall }));
const mockTransactions = jest.fn(() => ({ transaction: mockTransaction }));

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Horizon: {
      Server: jest.fn(() => ({
        transactions: mockTransactions,
      })),
    },
  };
});

describe("pollTransactionConfirmation (#1738)", () => {
  const sampleHash = "a".repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("confirms immediately when Horizon returns successful: true on first attempt", async () => {
    mockTxCall.mockResolvedValueOnce({ successful: true, ledger_attr: 51234 });

    const events: TransactionConfirmationProgress[] = [];
    const result = await pollTransactionConfirmation({
      txHash: sampleHash,
      network: "testnet",
      pollIntervalMs: 1,
      maxAttempts: 5,
      onProgress: p => events.push({ ...p }),
    });

    expect(result.confirmed).toBe(true);
    expect(result.status).toBe("confirmed");
    expect(result.ledger).toBe(51234);
    expect(result.attempts).toBe(1);
    expect(events.map(e => e.status)).toEqual([
      "submitted",
      "polling",
      "confirmed",
    ]);
  });

  it("continues polling through 404 NotFoundError until confirmed", async () => {
    const notFoundErr = Object.assign(new Error("Not Found"), {
      name: "NotFoundError",
      response: { status: 404 },
    });
    mockTxCall
      .mockRejectedValueOnce(notFoundErr)
      .mockRejectedValueOnce(notFoundErr)
      .mockResolvedValueOnce({ successful: true, ledger_attr: 99999 });

    const attemptsSeen: number[] = [];
    const result = await pollTransactionConfirmation({
      txHash: sampleHash,
      network: "testnet",
      pollIntervalMs: 1,
      maxAttempts: 5,
      onProgress: p => {
        if (p.status === "polling") {
          attemptsSeen.push(p.attempt);
        }
      },
    });

    expect(result.confirmed).toBe(true);
    expect(result.attempts).toBe(3);
    expect(result.ledger).toBe(99999);
    expect(attemptsSeen).toEqual([1, 2, 3]);
  });

  it("recovers from transient 500 errors and confirms on a subsequent attempt", async () => {
    mockTxCall
      .mockRejectedValueOnce(new Error("502 Bad Gateway"))
      .mockResolvedValueOnce({ successful: true, ledger: 42000 });

    const result = await pollTransactionConfirmation({
      txHash: sampleHash,
      network: "mainnet",
      pollIntervalMs: 1,
      maxAttempts: 4,
    });

    expect(result.confirmed).toBe(true);
    expect(result.ledger).toBe(42000);
    expect(result.attempts).toBe(2);
  });

  it("returns failed status when Horizon reports successful: false", async () => {
    mockTxCall.mockResolvedValueOnce({ successful: false, ledger_attr: 777 });

    const statuses: string[] = [];
    const result = await pollTransactionConfirmation({
      txHash: sampleHash,
      network: "testnet",
      pollIntervalMs: 1,
      maxAttempts: 5,
      onProgress: p => statuses.push(p.status),
    });

    expect(result.confirmed).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/rejected/i);
    expect(statuses).toEqual(["submitted", "polling", "failed"]);
  });

  it("returns timeout status when maxAttempts is exhausted", async () => {
    const notFoundErr = Object.assign(new Error("404"), {
      response: { status: 404 },
    });
    mockTxCall.mockRejectedValue(notFoundErr);

    const statuses: string[] = [];
    const result = await pollTransactionConfirmation({
      txHash: sampleHash,
      network: "testnet",
      pollIntervalMs: 1,
      maxAttempts: 3,
      onProgress: p => statuses.push(p.status),
    });

    expect(result.confirmed).toBe(false);
    expect(result.status).toBe("timeout");
    expect(result.attempts).toBe(3);
    expect(result.error).toMatch(/timed out/i);
    expect(statuses).toEqual([
      "submitted",
      "polling",
      "polling",
      "polling",
      "timeout",
    ]);
  });

  it("aborts immediately when AbortSignal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      pollTransactionConfirmation({
        txHash: sampleHash,
        network: "testnet",
        pollIntervalMs: 100,
        maxAttempts: 5,
        signal: controller.signal,
      })
    ).rejects.toThrow("Polling aborted");
    expect(mockTxCall).not.toHaveBeenCalled();
  });
});
