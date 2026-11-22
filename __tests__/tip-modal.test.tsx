import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TipModal } from "@/components/tipping/TipModal";
import {
  hasInsufficientBalance,
  submitTransaction,
} from "@/lib/stellar/payments";

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({
    kit: { signTransaction: async () => ({ signedTxXdr: "signed" }) },
  }),
}));
jest.mock("@/lib/session-replay", () => ({
  sessionReplay: { addBreadcrumb: jest.fn(), recordFlowError: jest.fn() },
}));
jest.mock("@/components/wallet/AddFundsButton", () => ({
  AddFundsButton: () => null,
}));
jest.mock("@/components/tipping/TipConfirmation", () => ({
  TipConfirmation: () => null,
}));
jest.mock("@stellar/stellar-sdk", () => ({
  TransactionBuilder: { fromXDR: () => ({}) },
  Networks: { TESTNET: "testnet" },
}));
jest.mock("@/lib/stellar/payments", () => ({
  buildTipTransaction: async () => ({ toXDR: () => "unsigned" }),
  submitTransaction: jest.fn(),
  hasInsufficientBalance: jest.fn(),
  checkAccountBalance: async () => ({ status: "funded" }),
  AccountNotFundedError: class extends Error {},
  getXLMPrice: async () => 0.25,
  calculateFeeEstimate: () => 0.00001,
  getRecommendedFeeStroops: async () => 100,
  MAX_TIP_AMOUNT_XLM: 1000,
  MIN_TIP_AMOUNT_XLM: 0.01,
}));

const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      quote_token: "quote",
      quoted_rate: 0.25,
      quoted_xlm_amount: 5,
      expires_at: new Date(Date.now() + 300_000).toISOString(),
    }),
  });
});
afterEach(() => {
  global.fetch = originalFetch;
});

it.each([false, true])(
  "handles the payment flow with insufficient balance=%s",
  async insufficient => {
    jest.mocked(hasInsufficientBalance).mockResolvedValueOnce(insufficient);
    if (!insufficient)
      jest
        .mocked(submitTransaction)
        .mockResolvedValueOnce({ success: true, hash: "tip-hash" });
    const onSuccess = jest.fn();
    const onError = jest.fn();
    render(
      <TipModal
        isOpen
        onClose={jest.fn()}
        recipientUsername="alice"
        recipientPublicKey={`G${"A".repeat(55)}`}
        senderPublicKey={`G${"B".repeat(55)}`}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
    fireEvent.change(screen.getByLabelText("Custom Amount"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Tip" }));
    if (insufficient) {
      await waitFor(() =>
        expect(onError).toHaveBeenCalledWith("Insufficient balance")
      );
      expect(submitTransaction).not.toHaveBeenCalled();
    } else {
      await waitFor(() =>
        expect(onSuccess).toHaveBeenCalledWith("tip-hash", "5")
      );
    }
  }
);
