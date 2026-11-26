/**
 * Tests for Wallet Disconnect Mid-Transaction Recovery (#1695)
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TipModal } from "@/components/tipping/TipModal";

const mockDisconnect = jest.fn();
const mockSignTransaction = jest.fn();

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ quote_token: "test", quoted_rate: 1, quoted_xlm_amount: 10 }),
});

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({
    kit: {
      signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
    },
    disconnect: mockDisconnect,
    isConnected: true,
  }),
}));

jest.mock("@/lib/stellar/payments", () => ({
  buildTipTransaction: jest.fn().mockResolvedValue({
    toXDR: () => "mock-xdr",
  }),
  submitTransaction: jest.fn(),
  pollTransactionConfirmation: jest.fn().mockResolvedValue({ status: "success" }),
  hasInsufficientBalance: jest.fn().mockResolvedValue(false),
  checkAccountBalance: jest.fn().mockResolvedValue({ status: "ok" }),
  AccountNotFundedError: class AccountNotFundedError extends Error {},
  getXLMPrice: jest.fn().mockResolvedValue(0.12),
  calculateFeeEstimate: jest.fn().mockReturnValue(0.00001),
  getRecommendedFeeStroops: jest.fn().mockResolvedValue(100),
  getFeeEstimateDetails: jest.fn().mockResolvedValue(null),
  MAX_TIP_AMOUNT_XLM: 1000,
  MIN_TIP_AMOUNT_XLM: 0.1,
}));

describe("TipModal wallet disconnect handling (#1695)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("detects wallet lock during signing, disconnects context, and shows actionable guidance", async () => {
    mockSignTransaction.mockRejectedValueOnce(new Error("Freighter is locked"));

    render(
      <TipModal
        isOpen={true}
        onClose={jest.fn()}
        recipientUsername="alice"
        recipientPublicKey="GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
        senderPublicKey="GB3D5R2WIGWWARMHKPVWCTC6V5K2TMTV5YAXOOOSRMA2AOCHR6IBYTTR"
      />
    );

    // Enter amount and click send
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: /review tip/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /confirm & sign/i })
    );

    await waitFor(() => {
      expect(mockSignTransaction).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
      expect(
        screen.getByText(/Wallet disconnected or locked during transaction/i)
      ).toBeInTheDocument();
    });
  });
});
