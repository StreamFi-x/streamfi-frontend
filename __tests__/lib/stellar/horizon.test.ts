/**
 * #1614 — first-page fetch must not default cursor to Horizon "now".
 */
const mockCall = jest.fn();
const mockCursor = jest.fn(() => ({ call: mockCall }));
const mockOrder = jest.fn(() => ({ cursor: mockCursor, call: mockCall }));
const mockLimit = jest.fn(() => ({ order: mockOrder }));
const mockForAccount = jest.fn(() => ({ limit: mockLimit }));
const mockPayments = jest.fn(() => ({ forAccount: mockForAccount }));

jest.mock("@stellar/stellar-sdk", () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      payments: mockPayments,
    })),
  },
}));

jest.mock("@/lib/stellar/config", () => ({
  getStellarNetwork: () => "testnet",
  getHorizonUrl: () => "https://horizon-testnet.stellar.org",
}));

import { fetchPaymentsReceived } from "@/lib/stellar/horizon";

describe("fetchPaymentsReceived (#1614)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-wire chain defaults after clearMocks
    mockCursor.mockImplementation(() => ({ call: mockCall }));
    mockOrder.mockImplementation(() => ({ cursor: mockCursor, call: mockCall }));
    mockLimit.mockImplementation(() => ({ order: mockOrder }));
    mockForAccount.mockImplementation(() => ({ limit: mockLimit }));
    mockPayments.mockImplementation(() => ({ forAccount: mockForAccount }));
  });

  it("omits cursor on the first page and returns real tip records", async () => {
    mockCall.mockResolvedValue({
      records: [
        {
          id: "pay-1",
          type: "payment",
          to: "GCRECEIVER",
          from: "GSENDER",
          asset_type: "native",
          amount: "12.5000000",
          transaction_hash: "abc123",
          created_at: "2026-09-01T12:00:00Z",
          ledger: 100,
          paging_token: "token-1",
        },
      ],
    });

    const result = await fetchPaymentsReceived({
      publicKey: "GCRECEIVER",
      limit: 200,
    });

    expect(mockOrder).toHaveBeenCalledWith("desc");
    expect(mockCursor).not.toHaveBeenCalled();
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(result.tips).toHaveLength(1);
    expect(result.tips[0]).toMatchObject({
      amount: "12.5000000",
      sender: "GSENDER",
      asset: "XLM",
      txHash: "abc123",
    });
    expect(result.nextCursor).toBe("token-1");
  });

  it("applies an explicit paging cursor on subsequent pages", async () => {
    mockCall.mockResolvedValue({ records: [] });

    await fetchPaymentsReceived({
      publicKey: "GCRECEIVER",
      cursor: "token-1",
    });

    expect(mockCursor).toHaveBeenCalledWith("token-1");
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it("never defaults the cursor to Horizon 'now'", async () => {
    mockCall.mockResolvedValue({ records: [] });

    await fetchPaymentsReceived({ publicKey: "GCRECEIVER" });

    const cursorArgs = mockCursor.mock.calls.flat();
    expect(cursorArgs).not.toContain("now");
    expect(mockCursor).not.toHaveBeenCalled();
  });
});
